
"use client";

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { Input } from "@/components/ui/input";
import { GameCard } from "./game-card";
import { Search } from 'lucide-react';
import { Button } from './ui/button';
import type { Game } from '@/types';
import { getClientGames } from '@/lib/games';
import { Skeleton } from './ui/skeleton';

export function GameList() {
    const [initialGames, setInitialGames] = useState<Game[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchGames = async () => {
            setLoading(true);
            const games = await getClientGames();
            setInitialGames(games);
            setLoading(false);
        };
        fetchGames();
    }, []);

    const filteredGames = useMemo(() => {
        if (!searchTerm) {
            return initialGames;
        }
        return initialGames.filter(game =>
            game.home_team.toLowerCase().includes(searchTerm.toLowerCase()) ||
            game.away_team.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [initialGames, searchTerm]);

    const PlayIcon = (props: React.SVGProps<SVGSVGElement>) => (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
        </svg>
    );

    const renderGameGrid = () => {
        if (loading) {
            return (
                 <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}
                </div>
            )
        }
        if (filteredGames.length > 0) {
            return (
                 <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {filteredGames.map(game => (
                        <GameCard game={game} key={game.id} />
                    ))}
                </div>
            )
        }
        return (
            <div className="text-center py-16">
                <h2 className="text-xl font-bold">No Games Found</h2>
                <p className="text-muted-foreground mt-2">
                    There are no upcoming games to display. Check back later!
                </p>
            </div>
        )
    }

    return (
        <>
            <div>
                <header className="relative flex items-center justify-center h-[60vh] md:h-[80vh] text-center overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full">
                         <video
                            src="https://firebasestorage.googleapis.com/v0/b/playcer-xbv5e.appspot.com/o/pexels-pavel-danilyuk-5495292%20(2160p).mp4?alt=media&token=27f40776-5a4a-4c27-9005-9942a6c1b353"
                            autoPlay
                            loop
                            muted
                            playsInline
                            className="object-cover w-full h-full"
                         />
                        <div className="absolute inset-0 bg-secondary/80"></div>
                         <div className="absolute inset-0 flex items-center justify-center">
                            <PlayIcon className="w-24 h-24 text-white/30" />
                        </div>
                    </div>
                    
                    <div className="container mx-auto relative z-10">
                        <h1 className="text-5xl md:text-7xl font-headline font-black uppercase tracking-tighter text-white">Stop Arguing. Start Winning.</h1>
                        <p className="mt-4 text-lg md:text-xl text-muted-foreground">Peer to Peer Betting that makes sports betting personal</p>
                        <div className="mt-8 max-w-2xl mx-auto">
                             <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                <Input
                                    type="text"
                                    placeholder="find your game"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-12 pr-4 py-6 text-lg bg-background/20 text-white placeholder:text-muted-foreground border-2 border-transparent focus:border-primary focus:bg-background/30"
                                />
                            </div>
                             <p className="mt-6 text-base max-w-xl mx-auto">
                               Tired of betting against the house? Playcer is the peer-to-peer app where you bet directly against friends and other fans. You set the odds, you make the challenge. It's just mano y mano.
                            </p>
                            <div className="mt-8 flex justify-center">
                                <Link href="/marketplace" passHref>
                                    <Button size="lg">Explore Betting Events</Button>
                                </Link>
                            </div>
                        </div>
                    </div>
                </header>
                
                <div className="container mx-auto py-12">
                     <h2 className="text-3xl font-bold mb-6">Upcoming Games</h2>
                    {renderGameGrid()}
                </div>
            </div>
        </>
    );
}
