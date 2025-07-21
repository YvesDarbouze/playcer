
"use client";

import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { getFirebaseApp } from "@/lib/firebase";
import type { User } from "@/types";
import { ResponsibleGamingForm } from "@/components/responsible-gaming-form";
import { LifeBuoy, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ResponsibleGamingPage() {
  const { user: authUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !authUser) {
      router.push("/signin");
    }
  }, [authUser, authLoading, router]);
  
  useEffect(() => {
      if (!authUser) return;

      const fetchUserProfile = async () => {
          setLoading(true);
          const db = getFirestore(getFirebaseApp());
          const userDocRef = doc(db, "users", authUser.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
              setUserProfile({ id: userDocSnap.id, ...userDocSnap.data() } as User);
          }
          setLoading(false);
      };

      fetchUserProfile();
  }, [authUser]);

  if (authLoading || loading) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
            <div className="w-full max-w-2xl space-y-8">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-96 w-full" />
            </div>
        </div>
    );
  }

  if (!authUser || !userProfile) {
    return null;
  }

  return (
    <main className="bg-muted/40 min-h-screen p-4 md:p-8">
        <div className="container mx-auto max-w-2xl">
            <header className="mb-8">
                <Link href="/dashboard" passHref>
                    <Button variant="outline" className="mb-4">
                        <ArrowLeft className="mr-2" />
                        Back to Dashboard
                    </Button>
                </Link>
                <div className="flex items-center gap-4">
                    <LifeBuoy className="h-10 w-10 text-primary" />
                    <div>
                        <h1 className="text-4xl font-headline font-black">Responsible Gaming</h1>
                        <p className="text-muted-foreground">Tools to help you play safely and responsibly.</p>
                    </div>
                </div>
            </header>
            
            <ResponsibleGamingForm user={userProfile} />

        </div>
    </main>
  );
}
