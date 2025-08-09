
"use client";

import { useState, useMemo } from 'react';
import { Input } from "@/components/ui/input";
import { GameCard } from "./game-card";
import { Search } from 'lucide-react';
import type { Game } from '@/types';
import Image from 'next/image';

interface GameListProps {
    initialGames: Game[];
}

export function GameList({ initialGames }: GameListProps) {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredGames = useMemo(() => {
        if (!searchTerm) {
            return initialGames;
        }
        return initialGames.filter(game =>
            game.home_team.toLowerCase().includes(searchTerm.toLowerCase()) ||
            game.away_team.toLowerCase().includes(searchTerm.toLowerCase()) ||
            game.sport_title.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [initialGames, searchTerm]);

    return (
        <div>
            <header className="relative bg-primary-dark-blue text-background-offwhite py-20 md:py-32 text-center overflow-hidden">
                <div className="absolute inset-0">
                     <Image
                        src="https://placehold.co/1920x1080.png"
                        alt="Background image of a sports stadium"
                        fill
                        className="object-cover opacity-20"
                        data-ai-hint="stadium lights"
                        priority
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-primary-dark-blue via-primary-dark-blue/80 to-primary-dark-blue/50"></div>
                </div>
                
                <div className="container mx-auto relative z-10">
                    <h1 className="text-5xl md:text-7xl lg:text-8xl font-headline font-black uppercase tracking-tighter">
                        The Peer-to-Peer Betting Exchange
                    </h1>
                    <p className="mt-4 text-lg md:text-xl text-accent-peach max-w-2xl mx-auto">
                       Challenge friends, not the house. Welcome to social betting.
                    </p>
                    <div className="mt-8 max-w-2xl mx-auto">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-grey" />
                            <Input 
                                type="search"
                                placeholder="Search for a team or league (e.g., 'Lakers' or 'NFL')"
                                className="w-full p-4 pl-12 text-lg rounded-full shadow-lg text-primary-dark-blue"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </header>
            
            <div className="container mx-auto py-12 -mt-16 relative z-20">
                {filteredGames.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {filteredGames.map(game => (
                            <GameCard key={game.id} game={game} />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-16 bg-background rounded-lg shadow-md">
                        <h2 className="text-xl font-bold">No Games Found</h2>
                        <p className="text-muted-foreground mt-2">
                            {initialGames.length > 0 ? "No games match your search." : "There are no upcoming games to display."}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
