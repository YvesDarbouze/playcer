
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
        return initialBets.filter(bet => 
            bet.homeTeam.toLowerCase().includes(searchTerm.toLowerCase()) ||
            bet.awayTeam.toLowerCase().includes(searchTerm.toLowerCase()) ||
            bet.marketDescription.toLowerCase().includes(searchTerm.toLowerCase()) ||
            bet.creatorUsername.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [initialBets, searchTerm]);


    return (
        <div>
            <div className="mb-6">
                <div className="relative w-full max-w-lg">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                        type="text"
                        placeholder="Search by team, market, or user..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                    />
                </div>
            </div>

            {filteredBets.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredBets.map(bet => <MarketplaceBetCard key={bet.id} bet={bet} />)}
                </div>
            ) : (
                 <div className="text-center py-16">
                    <h2 className="text-xl font-semibold">No Open Bets Found</h2>
                    <p className="text-muted-foreground mt-2">
                        {initialBets.length > 0 ? "No challenges match your search." : "There are no open challenges right now. Why not create one?"}
                    </p>
                </div>
            )}
        </div>
    )
}
