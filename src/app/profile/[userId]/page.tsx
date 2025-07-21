
import * as React from "react";
import { doc, getDoc, collection, query, where, getDocs, or, and, orderBy, limit, Timestamp } from "firebase/firestore";
import { firestore } from "@/lib/firebase-admin";
import { PublicProfile } from "@/components/public-profile";
import type { User, Bet } from "@/types";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

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
                where("creatorId", "==", userId),
                where("challengerId", "==", userId)
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
            matchedAt: data.matchedAt ? (data.matchedAt as Timestamp).toDate().toISOString() : null,
            settledAt: data.settledAt ? (data.settledAt as Timestamp).toDate().toISOString() : null,
        } as unknown as Bet;
    });
}


export default async function ProfilePage({ params }: { params: { userId: string } }) {
    const { userId } = params;
    const [user, settledBets] = await Promise.all([
        getUserProfile(userId),
        getSettledBets(userId),
    ]);
    
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
