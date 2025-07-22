
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
            <header className="relative text-center mb-12 overflow-hidden rounded-lg">
                 <div className="relative py-20 bg-primary/80 text-primary-foreground">
                    <Image
                        src="https://placehold.co/1920x1080"
                        alt="Dynamic sports header image"
                        fill
                        className="object-cover z-0"
                        data-ai-hint="sports stadium crowd"
                        priority
                    />
                    <div className="absolute inset-0 bg-[#08415C]/80 z-10"></div>

                    <div className="relative z-20 container mx-auto px-4">
                        <div className="absolute top-4 right-4">
                             <Link href="/signin">
                                <Button variant="destructive">
                                     <TwitterIcon className="mr-2 h-4 w-4" />
                                    Login with Twitter
                                </Button>
                            </Link>
                        </div>
                        <div>
                            <h1 className="text-4xl md:text-6xl font-headline font-black uppercase text-background">
                                I don&apos;t just want to Bet, I Want To Bet That M0+#*$%$*
                            </h1>
                            <p className="mt-4 text-xl md:text-2xl text-background/80">
                                Peer to Peer Betting that makes sports betting personal
                            </p>
                            <div className="mt-8 max-w-2xl mx-auto relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground" />
                                <Input
                                    type="text"
                                    placeholder="Search for a game or team..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full h-16 pl-14 text-lg bg-card text-card-foreground"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </header>

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
