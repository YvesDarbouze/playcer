
"use client";

import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getFirestore, doc, onSnapshot } from "firebase/firestore";
import { firestore } from "@/lib/firebase";
import type { User } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import { IdentityVerification } from "@/components/identity-verification";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, CheckCircle, Hourglass, AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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

    const userDocRef = doc(firestore, "users", authUser.uid);

    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
            setUserProfile({ id: docSnap.id, ...docSnap.data() } as User);
        } else {
             router.push('/dashboard');
        }
        setLoadingProfile(false);
    }, (error) => {
        console.error("Error fetching user profile:", error);
        router.push('/dashboard');
        setLoadingProfile(false);
    });

    return () => unsubscribe();
  }, [authUser, router]);


  const renderContent = () => {
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
    
    if (!userProfile) {
        // This case should be handled by the redirect in the useEffect,
        // but it's good practice to have a fallback.
        return null; 
    }

    switch (userProfile.kycStatus) {
        case 'verified':
            return (
                <Card>
                    <CardHeader className="items-center text-center">
                        <CheckCircle className="size-12 text-green-500" />
                        <CardTitle>You're Verified!</CardTitle>
                        <CardDescription>Your identity has been successfully verified. You now have full access to all features.</CardDescription>
                    </CardHeader>
                </Card>
            );
        case 'in_review':
            return (
                <Card>
                    <CardHeader className="items-center text-center">
                        <Hourglass className="size-12 text-yellow-500" />
                        <CardTitle>Verification in Review</CardTitle>
                        <CardDescription>Your documents have been submitted and are being reviewed. This usually takes a few minutes.</CardDescription>
                    </CardHeader>
                </Card>
            );
        case 'rejected':
             return (
                <Card>
                    <CardHeader className="items-center text-center">
                        <AlertCircle className="size-12 text-destructive" />
                        <CardTitle>Verification Required</CardTitle>
                        <CardDescription>There was an issue with your previous submission. Please try the verification process again.</CardDescription>
                    </CardHeader>
                    <CardContent>
                       <IdentityVerification user={userProfile} />
                    </CardContent>
                </Card>
            );
        case 'pending':
        default:
            return <IdentityVerification user={userProfile} />;
    }
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
        {renderContent()}
      </div>
    </main>
  );
}
