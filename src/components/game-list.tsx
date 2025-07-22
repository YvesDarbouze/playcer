
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
            game.away_team.toLowerCase().includes(searchTerm.toLowerCase())
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
                    <div className="absolute inset-0 bg-primary-dark-blue/80"></div>
                </div>
                
                <div className="container mx-auto relative">
                    <h1 className="text-7xl md:text-9xl font-headline font-black uppercase tracking-tighter">Stop Arguing. Start Winning.</h1>
                    <p className="mt-4 text-lg md:text-xl text-accent-peach">Peer to Peer Betting that makes sports betting personal</p>
                    <div className="mt-8 max-w-2xl mx-auto">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-grey" />
                            <Input 
                                type="search"
                                placeholder="Search for a game or team..."
                                className="w-full p-4 pl-12 text-lg text-primary-dark-blue"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </header>
            
            <div className="container mx-auto py-12">
                 <h2 className="text-3xl font-bold mb-6 text-primary-dark-blue">Upcoming Games</h2>
                {filteredGames.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredGames.map(game => (
                            <GameCard key={game.id} game={game} />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-16">
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
