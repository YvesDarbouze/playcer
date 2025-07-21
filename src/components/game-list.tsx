"use client";

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Input } from "@/components/ui/input";
import { GameCard } from "./game-card";
import { LayoutDashboard, Search } from 'lucide-react';
import { LoginButton } from './login-button';
import { Logo } from './icons';
import { Button } from './ui/button';
import type { Game } from '@/types';

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
            <header className="py-4 px-6 mb-8 rounded-lg shadow-md bg-card border">
                 <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                     <div className="flex items-center gap-3">
                        <Logo className="size-10 text-primary" />
                        <div>
                            <h1 className="text-2xl md:text-3xl font-headline font-black text-foreground">
                                Place Your Bets
                            </h1>
                             <p className="text-muted-foreground">Upcoming Games</p>
                        </div>
                    </div>
                     <div className="flex items-center gap-4 w-full md:w-auto">
                        <div className="relative w-full md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                            <Input
                                type="text"
                                placeholder="Search by team..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                         <Link href="/dashboard" passHref>
                           <Button variant="outline">
                             <LayoutDashboard className="mr-2 h-4 w-4" />
                             Dashboard
                           </Button>
                         </Link>
                         <LoginButton />
                     </div>
                 </div>
            </header>
            
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
