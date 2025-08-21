
"use client";

import * as React from "react";
import { getFirestore, doc, onSnapshot, collection, query, where, getDocs, orderBy, Timestamp, or } from "firebase/firestore";
import { useAuth } from "@/hooks/use-auth";
import { firestore } from "@/lib/firebase";
import type { User, Bet } from "@/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UserBetsTable } from "./user-bets-table";
import { Banknote, Trophy, LifeBuoy, PlusCircle, Store, Upload } from "lucide-react";
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldCheck, Hourglass } from "lucide-react";


const convertToBet = (doc: any): Bet => {
    const data = doc.data();
    return {
        id: doc.id,
        ...data,
        eventDate: (data.eventDate as Timestamp).toDate().toISOString(),
        createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
        settledAt: data.settledAt ? (data.settledAt as Timestamp).toDate().toISOString() : null,
    } as unknown as Bet;
};


export function UserDashboard() {
    const { user: authUser, loading: authLoading, updateUserProfileImage } = useAuth();
    const [userProfile, setUserProfile] = React.useState<User | null>(null);
    const [bets, setBets] = React.useState<Bet[]>([]);
    const [loadingData, setLoadingData] = React.useState(true);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    
    React.useEffect(() => {
        if (!authUser) return;

        const userDocRef = doc(firestore, "users", authUser.uid);
        const unsubscribeUser = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
                setUserProfile({ id: docSnap.id, ...docSnap.data() } as User);
            }
        });

        const betsQuery = query(
            collection(firestore, "bets"),
            or(
                where("creatorId", "==", authUser.uid),
                where("takers", `.${authUser.uid}`, ">", 0)
            ),
            orderBy("createdAt", "desc")
        );

        const unsubscribeBets = onSnapshot(betsQuery, (snapshot) => {
            const userBets = snapshot.docs.map(convertToBet);
            setBets(userBets);
            setLoadingData(false);
        }, (error) => {
            console.error("Error fetching bets:", error);
            setLoadingData(false);
        });

        return () => {
            unsubscribeUser();
            unsubscribeBets();
        };
    }, [authUser]);
    
    const pendingBets = bets.filter(b => b.status === 'pending_acceptance' && b.creatorId === authUser?.uid);
    const activeBets = bets.filter(b => b.status === 'accepted');
    const historyBets = bets.filter(b => b.status === 'resolved' || b.status === 'void');

    const handleAvatarClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && authUser) {
            updateUserProfileImage(file);
        }
    };

    const KYCAlert = () => {
        if (!userProfile) return null;

        switch (userProfile.kycStatus) {
            case 'pending':
                return (
                    <Alert>
                         <ShieldCheck className="h-4 w-4" />
                        <AlertTitle className="font-bold">Identity Verification Required</AlertTitle>
                        <AlertDescription className="flex justify-between items-center">
                            <p>Please verify your identity to enable all features, including withdrawals.</p>
                            <Link href="/verify-identity">
                                <Button>Verify Now</Button>
                            </Link>
                        </AlertDescription>
                    </Alert>
                );
            case 'in_review':
                 return (
                    <Alert variant="default" className="bg-yellow-50 border-yellow-200 text-yellow-800">
                         <Hourglass className="h-4 w-4" />
                        <AlertTitle className="font-bold">Verification Under Review</AlertTitle>
                        <AlertDescription>
                            Your documents have been submitted and are being reviewed. This usually takes a few minutes.
                        </AlertDescription>
                    </Alert>
                );
            default:
                return null;
        }
    }

    if (authLoading || loadingData) {
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
            <header className="mb-8 space-y-4">
                <KYCAlert />
                <Card className="shadow-lg">
                    <CardContent className="p-6 flex flex-col md:flex-row items-center gap-6">
                        <div className="relative group">
                            <Avatar className="h-24 w-24 border-4 border-primary cursor-pointer" onClick={handleAvatarClick}>
                                <AvatarImage src={userProfile.photoURL} alt={userProfile.displayName} />
                                <AvatarFallback>{userProfile.username.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" onClick={handleAvatarClick}>
                               <Upload className="h-8 w-8 text-white" />
                            </div>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                className="hidden"
                                accept="image/png, image/jpeg"
                            />
                        </div>

                        <div className="flex-1 text-center md:text-left">
                            <h1 className="text-3xl font-bold">{userProfile.displayName}</h1>
                            <p className="text-muted-foreground text-lg">@{userProfile.username}</p>
                        </div>
                         <div className="grid grid-cols-2 gap-2">
                             <Link href="/create-bet" passHref>
                                <Button className="w-full">
                                    <PlusCircle className="mr-2" />
                                    Create Bet
                                </Button>
                             </Link>
                              <Link href="/marketplace" passHref>
                                <Button className="w-full">
                                    <Store className="mr-2" />
                                    Marketplace
                                </Button>
                             </Link>
                            <Link href="/wallet" passHref>
                                <Button variant="secondary" className="col-span-2">
                                    <Banknote className="mr-2" />
                                    Manage Wallet
                                </Button>
                            </Link>
                            <Link href="/dashboard/responsible-gaming" passHref>
                                <Button variant="outline" className="col-span-2">
                                    <LifeBuoy className="mr-2" />
                                    Gaming Controls
                                </Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </header>

            <Tabs defaultValue="stats" className="w-full mb-8">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="stats"><Trophy className="mr-2"/> My Stats</TabsTrigger>
                </TabsList>
                <TabsContent value="stats">
                    <Card>
                        <CardHeader>
                            <CardTitle>Your Record</CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-wrap justify-around gap-4">
                             <div className="text-center">
                                <p className="text-4xl font-bold text-primary">{userProfile.wins}</p>
                                <p className="text-sm text-muted-foreground">Wins</p>
                            </div>
                            <div className="text-center">
                                 <p className="text-4xl font-bold text-destructive">{userProfile.losses}</p>
                                <p className="text-sm text-muted-foreground">Losses</p>
                            </div>
                             <div className="text-center">
                                 <p className="text-4xl font-bold">${userProfile.walletBalance.toFixed(2)}</p>
                                <p className="text-sm text-muted-foreground">Wallet</p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <section>
                <h2 className="text-2xl font-bold mb-4">My Bets</h2>
                <Tabs defaultValue="active">
                    <TabsList>
                        <TabsTrigger value="active">Active</TabsTrigger>
                        <TabsTrigger value="pending">Pending</TabsTrigger>
                        <TabsTrigger value="history">History</TabsTrigger>
                    </TabsList>
                    <TabsContent value="active">
                         <UserBetsTable bets={activeBets} currentUserId={authUser!.uid} />
                    </TabsContent>
                    <TabsContent value="pending">
                         <UserBetsTable bets={pendingBets} currentUserId={authUser!.uid} />
                    </TabsContent>
                    <TabsContent value="history">
                         <UserBetsTable bets={historyBets} currentUserId={authUser!.uid} />
                    </TabsContent>
                </Tabs>
            </section>
        </div>
    );
}
