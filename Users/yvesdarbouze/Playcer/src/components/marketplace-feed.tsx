
"use client";

import { useState, useMemo, useEffect } from 'react';
import type { Bet } from '@/types';
import { MarketplaceBetCard } from '@/components/marketplace-bet-card';
import { Input } from './ui/input';
import { Search } from 'lucide-react';
import { onSnapshot, collection, query, where, orderBy, Timestamp, getFirestore } from 'firebase/firestore';
import { app as firebaseApp } from '@/lib/firebase'; // Use client-side firebase

interface MarketplaceFeedProps {
    initialBets: Bet[];
}

// Helper to convert Firestore data to Bet type on the client
const convertToBet = (docSnap: any): Bet => {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    ...data,
    eventDate: (data.eventDate as Timestamp).toDate().toISOString(),
    createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
    settledAt: data.settledAt ? (data.settledAt as Timestamp).toDate().toISOString() : null,
  } as unknown as Bet;
}


export function MarketplaceFeed({ initialBets }: MarketplaceFeedProps) {
    const [bets, setBets] = useState(initialBets);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const firestore = getFirestore(firebaseApp);
        const betsRef = collection(firestore, "bets");
        const q = query(
            betsRef,
            where("isPublic", "==", true),
            where("status", "==", "pending"),
            orderBy("createdAt", "desc")
        );
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const updatedBets = snapshot.docs.map(convertToBet);
            setBets(updatedBets);
        });

        return () => unsubscribe();
    }, []);

    const filteredBets = useMemo(() => {
        if (!searchTerm.trim()) {
            return bets;
        }
        return bets.filter(bet => 
            bet.homeTeam.toLowerCase().includes(searchTerm.toLowerCase()) ||
            bet.awayTeam.toLowerCase().includes(searchTerm.toLowerCase()) ||
            bet.challengerUsername.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [bets, searchTerm]);


    return (
        <div>
            <div className="mb-8">
                <div className="relative w-full max-w-lg mx-auto sm:mx-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                        type="text"
                        placeholder="Search by team or user..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 text-base"
                    />
                </div>
            </div>

            {filteredBets.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredBets.map(bet => <MarketplaceBetCard key={bet.id} bet={bet} />)}
                </div>
            ) : (
                 <div className="text-center py-16 bg-card rounded-lg">
                    <h2 className="text-xl font-semibold">No Open Bets Found</h2>
                    <p className="text-muted-foreground mt-2">
                        {initialBets.length > 0 ? "No challenges match your search." : "There are no open challenges right now. Why not create one?"}
                    </p>
                </div>
            )}
        </div>
    )
}
