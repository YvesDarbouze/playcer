
"use client";

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import { auth, signOut, getFirebaseApp } from '@/lib/firebase';
import { onAuthStateChanged, getIdTokenResult } from 'firebase/auth';
import { doc, getDoc, getFirestore, Timestamp } from 'firebase/firestore';
import { useToast } from './use-toast';

interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  claims: { [key: string]: any } | null;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, claims: null });

// Helper to check self-exclusion status
const checkSelfExclusion = async (uid: string): Promise<boolean> => {
    try {
        const db = getFirestore(getFirebaseApp());
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const isExcluded = await checkSelfExclusion(user.uid);
        if (isExcluded) {
            setUser(null);
            setClaims(null);
            await signOut();
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

  return (
    <AuthContext.Provider value={{ user, loading, claims }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
