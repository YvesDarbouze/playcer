

"use client";

import * as React from "react";
import { doc, getDoc, collection, query, where, getDocs, or, and, orderBy, limit, Timestamp } from "firebase/firestore";
import { firestore } from "@/lib/firebase";
import { PublicProfile } from "@/components/public-profile";
import type { User, Bet } from "@/types";
import { notFound, useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";


async function getUserProfile(userId: string): Promise<User | null> {
    if (!userId) return null;
    const userRef = doc(firestore, "users", userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
        return null;
    }
    
    const data = userSnap.data();
    return {
        id: userSnap.id,
        ...data,
        createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
    } as unknown as User;
}

async function getSettledBets(userId: string): Promise<Bet[]> {
    if (!userId) return [];
    
    const betsRef = collection(firestore, "bets");
    const q = query(
        betsRef,
        and(
            where("isPublic", "==", true),
            where("status", "==", "settled"),
            or(
                where("challengerId", "==", userId),
                where("accepters", "array-contains", { accepterId: userId })
            )
        ),
        orderBy("settledAt", "desc"),
        limit(10)
    );

    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
            ...data,
            id: doc.id,
            eventDate: (data.eventDate as Timestamp).toDate().toISOString(),
            createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
            settledAt: data.settledAt ? (data.settledAt as Timestamp).toDate().toISOString() : null,
        } as unknown as Bet;
    });
}


export default function ProfilePage() {
    const params = useParams();
    const userId = params.userId as string;

    const [user, setUser] = React.useState<User | null>(null);
    const [settledBets, setSettledBets] = React.useState<Bet[]>([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        if (!userId) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const [userProfile, userBets] = await Promise.all([
                    getUserProfile(userId),
                    getSettledBets(userId),
                ]);

                if (!userProfile) {
                    notFound();
                } else {
                    setUser(userProfile);
                    setSettledBets(userBets);
                }
            } catch(e) {
                console.error("Failed to fetch profile data", e);
                notFound();
            } finally {
                setLoading(false);
            }
        };

        fetchData();

    }, [userId]);

    if (loading) {
        return (
            <main className="bg-muted/40 min-h-screen p-4 md:p-8">
                 <div className="container mx-auto max-w-4xl">
                     <div className="mb-4">
                        <Skeleton className="h-10 w-44" />
                    </div>
                    <Skeleton className="h-48 w-full" />
                    <Skeleton className="h-12 w-1/3 mt-8" />
                    <div className="space-y-4 mt-4">
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-24 w-full" />
                    </div>
                 </div>
            </main>
        )
    }
    
    if (!user) {
        return null;
    }

    return (
        <main className="bg-muted/40 min-h-screen p-4 md:p-8">
            <div className="container mx-auto max-w-4xl">
                 <div className="mb-4">
                    <Link href="/dashboard" passHref>
                        <Button variant="outline">
                            <ArrowLeft className="mr-2" />
                            Back to Dashboard
                        </Button>
                    </Link>
                </div>
                <PublicProfile user={user} settledBets={settledBets} />
            </div>
        </main>
    );
}

    
