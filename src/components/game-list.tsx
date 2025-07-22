
"use client";

import { useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Input } from "@/components/ui/input";
import { GameCard } from "./game-card";
import { Search } from 'lucide-react';
import { Button } from './ui/button';
import type { Game } from '@/types';
import { LoginButton } from './login-button';

// Placeholder icon for Twitter
const TwitterIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M22 4s-.7 2.1-2 3.4c1.6 1.4 3.3 4.9 3.3 4.9s-5.2-.6-5.2-.6l-1.5-1.5s-2.3 2.7-4.8 2.7c-2.5 0-4.8-2.7-4.8-2.7S5 12.3 5 12.3s3.7-1.4 3.7-1.4L10 9.8s-1.8-2.2-1.8-2.2l-1.2-1.2S4.8 4 4.8 4s5.4 3.5 12.4 3.5c7 0 4.8-3.5 4.8-3.5z"/></svg>
);


export function GameList({ initialGames }: GameListProps) {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredGames = useMemo(() => {
        if (!searchTerm) {
            return initialGames;
        }
        return initialGames.filter(game =>
            game.home_team.toLowerCase().includes(searchTerm.toLowerCase()) ||
            game.away_team.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [initialGames, searchTerm]);

    return (
        <div>
            <h2 className="text-3xl font-headline font-black mb-6">Upcoming Games</h2>
            
            {filteredGames.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredGames.map(game => (
                        <GameCard key={game.id} game={game} />
                    ))}
                </div>
            ) : (
                <div className="text-center py-16">
                    <h2 className="text-xl font-semibold">No Games Found</h2>
                    <p className="text-muted-foreground mt-2">
                        {initialGames.length > 0 ? "No games match your search." : "There are no upcoming games to display."}
                    </p>
                </div>
            )}
        </div>
    );
}
