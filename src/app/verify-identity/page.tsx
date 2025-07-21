
"use client";

import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { getFirebaseApp } from "@/lib/firebase";
import type { User } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import { IdentityVerification } from "@/components/identity-verification";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function VerifyIdentityPage() {
  const { user: authUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    if (!authLoading && !authUser) {
      router.push("/signin");
    }
  }, [authUser, authLoading, router]);

  useEffect(() => {
    if (!authUser) return;

    const fetchUserProfile = async () => {
      setLoadingProfile(true);
      const db = getFirestore(getFirebaseApp());
      const userDocRef = doc(db, "users", authUser.uid);
      try {
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const profile = { id: userDocSnap.id, ...userDocSnap.data() } as User;
          setUserProfile(profile);
          // If status is not pending, user shouldn't be here.
          if (profile.kycStatus !== 'pending') {
              router.push('/dashboard');
          }
        } else {
            // Profile doesn't exist, something is wrong
            router.push('/dashboard');
        }
      } catch (error) {
        console.error("Error fetching user profile:", error);
        router.push('/dashboard');
      } finally {
        setLoadingProfile(false);
      }
    };

    fetchUserProfile();
  }, [authUser, router]);

  if (authLoading || loadingProfile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-md space-y-4">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
      </div>
    );
  }

  if (!authUser || !userProfile || userProfile.kycStatus !== 'pending') {
    // This will be shown briefly before the redirect kicks in.
    return null;
  }

  return (
    <main className="bg-muted/40 min-h-screen p-4 md:p-8 flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="mb-4">
            <Link href="/dashboard" passHref>
                <Button variant="outline">
                    <ArrowLeft className="mr-2" />
                    Back to Dashboard
                </Button>
            </Link>
        </div>
        <IdentityVerification user={userProfile} />
      </div>
    </main>
  );
}
