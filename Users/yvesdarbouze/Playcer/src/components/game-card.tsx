
"use client";

import * as React from 'react';
import Image from 'next/image';
import { format } from 'date-fns';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from './ui/button';
import { Swords, ArrowRight, TrendingUp, TrendingDown, ChevronDown, Loader2 } from 'lucide-react';
import { BetCreationModal } from './bet-creation-modal';
import type { Game } from '@/types';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { LoginButton } from './login-button';
import { getTeamLogoUrl } from '@/lib/team-logo-helper';
import { cn } from '@/lib/utils';
import { getFirestore, collection, onSnapshot, query, limit, Timestamp } from 'firebase/firestore';
import { getFirebaseApp } from '@/lib/firebase';
import { Separator } from './ui/separator';
import { useRouter } from 'next/navigation';

interface GameCardProps {
    game: Game;
}

type BookmakerOdds = {
    key: string;
    title: string;
    last_update: string;
    markets: {
        key: "h2h" | "spreads" | "totals";
        outcomes: { name: string; price: number, point?: number }[];
    }[];
};

const OddsDisplay = ({ label, value, team }: { label: string, value: number, team: string }) => (
    <div className="flex justify-between items-center text-sm p-2 rounded-md hover:bg-muted">
        <p className="text-muted-foreground">{team}</p>
        <p className="font-mono font-bold text-primary">{value > 0 ? `+${value}` : value}</p>
    </div>
)


export function GameCard({ game }: GameCardProps) {
    const [isModalOpen, setIsModalOpen] = React.useState(false);
    const { user, loading } = useAuth();
    const router = useRouter();
    const [gameTime, setGameTime] = React.useState<Date | null>(null);
    const [odds, setOdds] = React.useState<BookmakerOdds | null>(null);
    const [loadingOdds, setLoadingOdds] = React.useState(true);


    React.useEffect(() => {
        setGameTime(new Date(game.commence_time));

        const db = getFirestore(getFirebaseApp());
        const oddsQuery = query(collection(db, `games/${game.id}/bookmaker_odds`), limit(1));
        
        const unsubscribe = onSnapshot(oddsQuery, (snapshot) => {
            if (!snapshot.empty) {
                const oddsData = snapshot.docs[0].data() as BookmakerOdds;
                setOdds(oddsData);
            }
            setLoadingOdds(false);
        }, (error) => {
            console.error("Error fetching odds:", error);
            setLoadingOdds(false);
        });

        return () => unsubscribe();

    }, [game.commence_time, game.id]);

    const handleCreateBetClick = (e: React.MouseEvent) => {
        e.stopPropagation(); 
        if (!user && !loading) {
            router.push('/signin');
        } else if (user) {
            setIsModalOpen(true);
        }
    };

    const homeLogo = getTeamLogoUrl(game.home_team, game.sport_key);
    const awayLogo = getTeamLogoUrl(game.away_team, game.sport_key);

    const h2hMarket = odds?.markets.find(m => m.key === 'h2h');
    const awayTeamOdds = h2hMarket?.outcomes.find(o => o.name === game.away_team);
    const homeTeamOdds = h2hMarket?.outcomes.find(o => o.name === game.home_team);

    const handleCardClick = () => {
       if (user) {
            setIsModalOpen(true);
        } else {
            router.push('/signin');
        }
    };

    return (
        <>
            <Card 
                className="hover:shadow-lg transition-all duration-300 flex flex-col overflow-hidden cursor-pointer"
                onClick={handleCardClick}
            >
                <CardContent className="p-4 flex-grow flex flex-col items-center justify-center transition-all duration-300">
                     {gameTime && (
                         <div className="text-center text-muted-foreground text-sm w-full">
                            <p>{format(gameTime, "EEE, MMM d, h:mm a")}</p>
                        </div>
                    )}
                    <div className="flex items-center justify-around text-center w-full flex-grow space-x-2 my-4">
                        <div className="flex flex-col items-center text-center">
                            <Image src={awayLogo} alt={`${game.away_team} logo`} width={80} height={80} className="h-16 w-auto transition-all"/>
                            <p className="font-bold text-lg mt-1">{game.away_team}</p>
                            {awayTeamOdds && <p className="font-mono text-sm">{awayTeamOdds.price > 0 ? `+${awayTeamOdds.price}` : awayTeamOdds.price}</p>}
                        </div>
                        <div className="text-muted-foreground font-bold text-xl">@</div>
                        <div className="flex flex-col items-center text-center">
                            <Image src={homeLogo} alt={`${game.home_team} logo`} width={80} height={80} className="h-16 w-auto transition-all"/>
                            <p className="font-bold text-lg mt-1">{game.home_team}</p>
                             {homeTeamOdds && <p className="font-mono text-sm">{homeTeamOdds.price > 0 ? `+${homeTeamOdds.price}` : homeTeamOdds.price}</p>}
                        </div>
                    </div>
                </CardContent>

                <div className='p-2 bg-muted/50 text-center cursor-pointer' onClick={handleCardClick}>
                    <Button variant="ghost" className="w-full font-bold h-12 text-base">
                        <Swords className="mr-2" />
                        Create Challenge
                    </Button>
                </div>
            </Card>
            {gameTime && (
                 <BetCreationModal
                    isOpen={isModalOpen}
                    onOpenChange={setIsModalOpen}
                    game={game}
                    odds={odds}
                    loadingOdds={loadingOdds}
                />
            )}
        </>
    );
}
