
"use client";

import * as React from "react";
import { doc, getDoc, collection, query, where, getDocs, or, and, orderBy, limit, Timestamp } from "firebase/firestore";
import { firestore } from "@/lib/firebase"; // Use CLIENT-SIDE SDK
import { PublicProfile } from "@/components/public-profile";
import type { User, Bet } from "@/types";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";


async function getUserProfile(userId: string): Promise<User | null> {
    if (!userId) return null;
    try {
        const userRef = doc(firestore, "users", userId);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            return null;
        }
        
        const data = userSnap.data();
        // Convert Firestore Timestamps to serializable strings
        return {
            id: userSnap.id,
            ...data,
            createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
        } as unknown as User;
    } catch (error) {
        console.error("Error fetching user profile on client:", error);
        return null;
    }
}

async function getSettledBets(userId: string): Promise<Bet[]> {
    if (!userId) return [];
    
    try {
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
            // Convert Firestore Timestamps to serializable strings
            return {
                ...data,
                id: doc.id,
                eventDate: (data.eventDate as Timestamp).toDate().toISOString(),
                createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
                settledAt: data.settledAt ? (data.settledAt as Timestamp).toDate().toISOString() : null,
            } as unknown as Bet;
        });
    } catch (error) {
        console.error("Error fetching settled bets on client:", error);
        return [];
    }
}


export default function ProfilePage({ params }: { params: { userId: string } }) {
    const { userId } = params;
    const [user, setUser] = React.useState<User | null>(null);
    const [settledBets, setSettledBets] = React.useState<Bet[]>([]);
    const [loading, setLoading] = React.useState(true);
    
    React.useEffect(() => {
        const fetchData = async () => {
            if (!userId) return;
            setLoading(true);
            const [userProfile, userBets] = await Promise.all([
                getUserProfile(userId),
                getSettledBets(userId),
            ]);
            setUser(userProfile);
            setSettledBets(userBets);
            setLoading(false);
        }
        fetchData();
    }, [userId]);

    if (loading) {
        return (
            <main className="bg-muted/40 min-h-screen p-4 md:p-8">
                 <div className="container mx-auto max-w-4xl space-y-8">
                     <Skeleton className="h-40 w-full" />
                     <Skeleton className="h-64 w-full" />
                 </div>
            </main>
        )
    }
    
    if (!user) {
        notFound();
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
