
"use client";

import * as React from "react";
import {
  getFirestore,
  doc,
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  getDocs,
  where,
  Timestamp
} from "firebase/firestore";
import { useAuth } from "@/hooks/use-auth";
import { getFirebaseApp } from "@/lib/firebase";
import type { User, Transaction } from "@/types";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { Wallet } from "@/components/wallet";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const convertToTransaction = (doc: any): Transaction => {
    const data = doc.data();
    return {
        id: doc.id,
        ...data,
        createdAt: (data.createdAt as Timestamp).toDate(),
    } as Transaction;
};


export default function WalletPage() {
  const { user: authUser, loading: authLoading } = useAuth();
  const router = useRouter();

  const [userProfile, setUserProfile] = React.useState<User | null>(null);
  const [transactions, setTransactions] = React.useState<Transaction[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!authLoading && !authUser) {
      router.push("/signin");
    }
  }, [authUser, authLoading, router]);

  React.useEffect(() => {
    if (!authUser) return;

    const db = getFirestore(getFirebaseApp());

    // Real-time listener for user profile
    const userDocRef = doc(db, "users", authUser.uid);
    const unsubscribeUser = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
            setUserProfile({ id: docSnap.id, ...docSnap.data() } as User);
        } else {
            router.push('/dashboard');
        }
        setLoading(false);
    }, (error) => {
        console.error("Error listening to user profile:", error);
        setLoading(false);
    });

    // Initial fetch for transactions
    const fetchTransactions = async () => {
        const txQuery = query(
            collection(db, "transactions"),
            where("userId", "==", authUser.uid),
            orderBy("createdAt", "desc"),
            limit(25)
        );
        const txSnap = await getDocs(txQuery);
        setTransactions(txSnap.docs.map(convertToTransaction));
    };

    fetchTransactions();

    return () => {
      unsubscribeUser();
    };
  }, [authUser, router]);
  
  const isLoading = authLoading || loading;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-2xl space-y-4">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!authUser || !userProfile) {
    return null;
  }

  return (
    <main className="bg-muted/40 min-h-screen p-4 md:p-8 flex justify-center">
      <div className="w-full max-w-3xl">
        <div className="mb-4">
            <Link href="/dashboard" passHref>
                <Button variant="outline">
                    <ArrowLeft className="mr-2" />
                    Back to Dashboard
                </Button>
            </Link>
        </div>
        <Wallet user={userProfile} transactions={transactions} />
      </div>
    </main>
  );
}
