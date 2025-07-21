
"use client";

import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { getFirebaseApp } from "@/lib/firebase";
import type { User } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { CreateBetForm } from "@/components/create-bet-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function CreateBetPage() {
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
          setUserProfile({ id: userDocSnap.id, ...userDocSnap.data() } as User);
        } else {
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
  
  const isLoading = authLoading || loadingProfile;
  const isVerified = userProfile?.kycStatus === 'verified';

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-2xl space-y-4">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!authUser) {
    return null;
  }

  return (
    <main className="bg-muted/40 min-h-screen p-4 md:p-8 flex items-center justify-center">
      <div className="w-full max-w-2xl">
        <div className="mb-4">
            <Link href="/dashboard" passHref>
                <Button variant="outline">
                    <ArrowLeft className="mr-2" />
                    Back to Dashboard
                </Button>
            </Link>
        </div>
        
        {isVerified ? (
          <CreateBetForm />
        ) : (
          <Card>
            <CardHeader className="text-center">
                <ShieldAlert className="mx-auto h-12 w-12 text-destructive" />
                <CardTitle>Verification Required</CardTitle>
                <CardDescription>
                    You must verify your identity before you can create bets. Please complete the KYC process.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
                <Link href="/verify-identity" passHref>
                    <Button>Verify Identity</Button>
                </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
