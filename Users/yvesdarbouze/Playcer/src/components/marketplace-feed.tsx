
"use client";

import { useState, useMemo } from 'react';
import type { Bet } from '@/types';
import { MarketplaceBetCard } from '@/components/marketplace-bet-card';
import { Input } from './ui/input';
import { Search } from 'lucide-react';

interface MarketplaceFeedProps {
    initialBets: Bet[];
}

export function MarketplaceFeed({ initialBets }: MarketplaceFeedProps) {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredBets = useMemo(() => {
        if (!searchTerm.trim()) {
            return initialBets;
        }
        return initialBets.filter(bet => 
            bet.gameDetails.home_team.toLowerCase().includes(searchTerm.toLowerCase()) ||
            bet.gameDetails.away_team.toLowerCase().includes(searchTerm.toLowerCase()) ||
            bet.creatorUsername.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [initialBets, searchTerm]);


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
