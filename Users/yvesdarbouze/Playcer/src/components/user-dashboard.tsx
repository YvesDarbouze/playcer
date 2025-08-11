
"use client";

import * as React from "react";
import { getFirestore, doc, getDoc, collection, query, where, getDocs, orderBy, Timestamp, or } from "firebase/firestore";
import { useAuth } from "@/hooks/use-auth";
import { getFirebaseApp } from "@/lib/firebase";
import type { User, Bet } from "@/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UserBetsTable } from "./user-bets-table";
import { Banknote, Trophy, ShieldHalf, Swords, Hourglass, LifeBuoy, ShieldCheck, PlusCircle, Store, Upload } from "lucide-react";
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


const convertToBet = (doc: any): Bet => {
    const data = doc.data();
    return {
        id: doc.id,
        ...data,
        gameDetails: {
            ...data.gameDetails,
            commence_time: (data.gameDetails.commence_time as Timestamp).toDate(),
        },
        createdAt: (data.createdAt as Timestamp).toDate(),
        settledAt: data.settledAt ? (data.settledAt as Timestamp).toDate() : null,
    } as Bet;
};


export function UserDashboard() {
    const { user: authUser, loading: authLoading, updateUserProfileImage } = useAuth();
    const [userProfile, setUserProfile] = React.useState<User | null>(null);
    const [bets, setBets] = React.useState<Bet[]>([]);
    const [loading, setLoading] = React.useState(true);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    
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
            
            // Fetch all bets where user is challenger or recipient
            const betsRef = collection(db, "bets");
            const q = query(
                betsRef, 
                or(
                    where("challengerId", "==", authUser.uid),
                    where("recipientId", "==", authUser.uid)
                ),
                orderBy("createdAt", "desc")
            );

            const querySnapshot = await getDocs(q);
            const userBets = querySnapshot.docs.map(convertToBet);
            
            setBets(userBets);
            setLoading(false);
        };

        fetchData();
    }, [authUser]);
    
    const pendingBets = bets.filter(b => b.status === 'pending_acceptance');
    const activeBets = bets.filter(b => b.status === 'active');
    const historyBets = bets.filter(b => b.status === 'completed' || b.status === 'void' || b.status === 'declined' || b.status === 'expired');

    const handleAvatarClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && authUser) {
            updateUserProfileImage(file);
        }
    };

    React.useEffect(() => {
        if (authUser && userProfile && authUser.photoURL !== userProfile.photoURL) {
            setUserProfile(prev => prev ? { ...prev, photoURL: authUser.photoURL! } : null);
        }
    }, [authUser, userProfile]);

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

    if (loading || authLoading) {
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
                        <div className="flex flex-wrap justify-center gap-4">
                            <div className="text-center">
                                <p className="text-3xl font-bold text-primary">{userProfile.wins}</p>
                                <p className="text-sm text-muted-foreground">Wins</p>
                            </div>
                            <div className="text-center">
                                 <p className="text-3xl font-bold text-destructive">{userProfile.losses}</p>
                                <p className="text-sm text-muted-foreground">Losses</p>
                            </div>
                             <div className="text-center">
                                 <p className="text-3xl font-bold">${userProfile.walletBalance.toFixed(2)}</p>
                                <p className="text-sm text-muted-foreground">Wallet</p>
                            </div>
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

    