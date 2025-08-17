
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
import { GameDetailsModal } from './game-details-modal';

interface GameListProps {
    initialGames: Game[];
}

export function GameList({ initialGames }: GameListProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedGame, setSelectedGame] = useState<Game | null>(null);

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
    
    const handleModalClose = () => {
        setSelectedGame(null);
    }

    return (
        <>
            <div>
                <header className="relative flex items-center justify-center h-[60vh] md:h-[80vh] text-center overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full">
                         <video
                            src="https://firebasestorage.googleapis.com/v0/b/playcer-xbv5e.firebasestorage.app/o/2_the_simplifier_202508150826.mp4?alt=media&token=f2cfef79-14a9-42e8-810d-86c5b14614a3"
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
                    {filteredGames.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {filteredGames.map(game => (
                                <GameCard key={game.id} game={game} onCardClick={setSelectedGame} />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-16">
                            <h2 className="text-xl font-bold">No Games Found</h2>
                            <p className="text-muted-foreground mt-2">
                                There are no upcoming games to display.
                            </p>
                        </div>
                    )}
                </div>
            </div>
            {selectedGame && (
                <GameDetailsModal
                    game={selectedGame}
                    isOpen={!!selectedGame}
                    onOpenChange={(isOpen) => {
                        if (!isOpen) {
                            handleModalClose();
                        }
                    }}
                />
            )}
        </>
    );
}
