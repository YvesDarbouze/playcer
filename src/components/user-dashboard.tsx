
"use client";

import * as React from "react";
import { getFirestore, doc, getDoc, collection, query, where, getDocs, orderBy, Timestamp } from "firebase/firestore";
import { useAuth } from "@/hooks/use-auth";
import { getFirebaseApp } from "@/lib/firebase";
import type { User, Bet } from "@/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UserBetsTable } from "./user-bets-table";
import { Banknote, Trophy, ShieldHalf, Swords, Hourglass } from "lucide-react";

const convertToBet = (doc: any): Bet => {
    const data = doc.data();
    return {
        id: doc.id,
        ...data,
        eventDate: (data.eventDate as Timestamp).toDate(),
        createdAt: (data.createdAt as Timestamp).toDate(),
    } as Bet;
};


export function UserDashboard() {
    const { user: authUser } = useAuth();
    const [userProfile, setUserProfile] = React.useState<User | null>(null);
    const [pendingBets, setPendingBets] = React.useState<Bet[]>([]);
    const [otherBets, setOtherBets] = React.useState<Bet[]>([]);
    const [loading, setLoading] = React.useState(true);
    
    React.useEffect(() => {
        if (!authUser) return;

        const fetchData = async () => {
            setLoading(true);
            const db = getFirestore(getFirebaseApp());

            // Fetch User Profile
            const userDocRef = doc(db, "users", authUser.uid);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
                setUserProfile({ id: userDocSnap.id, ...userDocSnap.data() } as User);
            }

            // Fetch Pending Bets (created by user, status 'open')
            const pendingQuery = query(
                collection(db, "bets"),
                where("creatorId", "==", authUser.uid),
                where("status", "==", "open"),
                orderBy("createdAt", "desc")
            );
            const pendingSnap = await getDocs(pendingQuery);
            const pending = pendingSnap.docs.map(convertToBet);
            setPendingBets(pending);


            // Fetch Matched & Settled Bets involving the user
            const asCreatorQuery = query(
                collection(db, "bets"),
                where("creatorId", "==", authUser.uid),
                where("status", "in", ["matched", "settled", "void"])
            );
            const asChallengerQuery = query(
                collection(db, "bets"),
                where("challengerId", "==", authUser.uid),
                 where("status", "in", ["matched", "settled", "void"])
            );
            
            const [creatorSnap, challengerSnap] = await Promise.all([
                getDocs(asCreatorQuery),
                getDocs(asChallengerQuery)
            ]);

            const combinedBets = [
                ...creatorSnap.docs.map(convertToBet),
                ...challengerSnap.docs.map(convertToBet),
            ];
            
            // Simple deduplication
            const uniqueBets = Array.from(new Map(combinedBets.map(bet => [bet.id, bet])).values());
            
            // Sort by creation date descending
            uniqueBets.sort((a, b) => b.createdAt.seconds - a.createdAt.seconds);

            setOtherBets(uniqueBets);

            setLoading(false);
        };

        fetchData();
    }, [authUser]);

    if (loading) {
        return (
             <div className="container mx-auto p-4 md:p-8 space-y-8">
                <Skeleton className="h-40 w-full rounded-lg" />
                <Skeleton className="h-64 w-full rounded-lg" />
            </div>
        )
    }

    if (!userProfile) {
        return <p>User profile not found.</p>
    }

    return (
        <div className="container mx-auto p-4 md:p-8">
            <header className="mb-8">
                <Card className="shadow-lg">
                    <CardContent className="p-6 flex flex-col md:flex-row items-center gap-6">
                        <Avatar className="h-24 w-24 border-4 border-primary">
                            <AvatarImage src={userProfile.photoURL} alt={userProfile.displayName} />
                            <AvatarFallback>{userProfile.username.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 text-center md:text-left">
                            <h1 className="text-3xl font-headline font-black">{userProfile.displayName}</h1>
                            <p className="text-muted-foreground text-lg">@{userProfile.username}</p>
                        </div>
                        <div className="flex flex-wrap justify-center gap-4">
                            <div className="text-center">
                                <p className="text-3xl font-headline font-black text-primary">{userProfile.wins}</p>
                                <p className="text-sm text-muted-foreground">Wins</p>
                            </div>
                            <div className="text-center">
                                 <p className="text-3xl font-headline font-black text-destructive">{userProfile.losses}</p>
                                <p className="text-sm text-muted-foreground">Losses</p>
                            </div>
                             <div className="text-center">
                                 <p className="text-3xl font-headline font-black">${userProfile.walletBalance.toFixed(2)}</p>
                                <p className="text-sm text-muted-foreground">Wallet</p>
                            </div>
                        </div>
                        <Button>
                            <Banknote className="mr-2" />
                            Manage Wallet
                        </Button>
                    </CardContent>
                </Card>
            </header>

            <div className="grid grid-cols-1 gap-8">
                {pendingBets.length > 0 && (
                     <section>
                         <h2 className="text-2xl font-headline font-black mb-4 flex items-center gap-2"><Hourglass className="text-primary"/>Pending Challenges</h2>
                        <UserBetsTable bets={pendingBets} currentUserId={authUser!.uid} type="pending" />
                    </section>
                )}
               
                <section>
                    <h2 className="text-2xl font-headline font-black mb-4 flex items-center gap-2"><Swords className="text-primary"/>Bet History</h2>
                    <UserBetsTable bets={otherBets} currentUserId={authUser!.uid} type="history" />
                </section>
            </div>
        </div>
    );
}
