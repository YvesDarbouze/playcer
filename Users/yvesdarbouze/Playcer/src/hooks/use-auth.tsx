
"use client";

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import { auth, signOut as firebaseSignOut, storage } from '@/lib/firebase';
import { onAuthStateChanged, getIdTokenResult, updateProfile } from 'firebase/auth';
import { doc, getDoc, getFirestore, Timestamp, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useToast } from './use-toast';

interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  claims: { [key: string]: any } | null;
  updateUserProfileImage: (file: File) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({ 
    user: null, 
    loading: true, 
    claims: null, 
    updateUserProfileImage: async () => {},
    signOut: async () => {}
});

// Helper to check self-exclusion status
const checkSelfExclusion = async (uid: string): Promise<boolean> => {
    try {
        const db = getFirestore();
        const userDocRef = doc(db, "users", uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            const exclusionInfo = userData.selfExclusion;
            if (exclusionInfo?.isActive) {
                if (exclusionInfo.endDate === null) { // Permanent exclusion
                    return true;
                }
                const endDate = (exclusionInfo.endDate as Timestamp).toDate();
                if (new Date() < endDate) { // Still within exclusion period
                    return true;
                }
            }
        }
        return false;
    } catch (error) {
        console.error("Error checking self-exclusion status:", error);
        return false; // Fail open to not lock out users due to error
    }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [claims, setClaims] = useState<{ [key: string]: any } | null>(null);
  const { toast } = useToast();

  const handleSignOut = async () => {
    try {
        await firebaseSignOut(auth);
        setUser(null);
        setClaims(null);
    } catch (error) {
        console.error("Error signing out: ", error);
        toast({ title: "Error", description: "Failed to sign out.", variant: "destructive" });
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const isExcluded = await checkSelfExclusion(user.uid);
        if (isExcluded) {
            setUser(null);
            setClaims(null);
            await firebaseSignOut(auth);
            toast({
                title: "Account Suspended",
                description: "You are currently in a self-exclusion period.",
                variant: "destructive",
            });
        } else {
            const idTokenResult = await getIdTokenResult(user);
            setUser(user);
            setClaims(idTokenResult.claims);
        }
      } else {
        setUser(null);
        setClaims(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [toast]);

  const updateUserProfileImage = async (file: File) => {
    if (!user) {
        toast({ title: 'Error', description: 'You must be logged in to upload an image.', variant: 'destructive'});
        return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      toast({ title: 'Error', description: 'File size cannot exceed 5MB.', variant: 'destructive'});
      return;
    }
    
    const storageRef = ref(storage, `profile_pictures/${user.uid}/${file.name}`);

    try {
        toast({ title: 'Uploading...', description: 'Your new profile picture is being uploaded.' });
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);

        // Update Firebase Auth user profile
        await updateProfile(user, { photoURL: downloadURL });

        // Update Firestore user document
        const db = getFirestore();
        const userDocRef = doc(db, 'users', user.uid);
        await updateDoc(userDocRef, { photoURL: downloadURL });
        
        // Force refresh of the user object to reflect changes
        const refreshedUser = { ...user, photoURL: downloadURL };
        setUser(refreshedUser);

        toast({ title: 'Success!', description: 'Your profile picture has been updated.' });

    } catch (error) {
        console.error("Error uploading profile picture:", error);
        toast({ title: 'Upload Failed', description: 'There was an error updating your picture. Please try again.', variant: 'destructive'});
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, claims, updateUserProfileImage, signOut: handleSignOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
