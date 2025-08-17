

"use client";

import * as React from 'react';
import Image from 'next/image';
import { format } from 'date-fns';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from './ui/button';
import { Swords } from 'lucide-react';
import type { Game } from '@/types';
import { getTeamLogoUrl } from '@/lib/team-logo-helper';
import { getFirestore, collection, onSnapshot, query, limit, Timestamp } from 'firebase/firestore';
import { getFirebaseApp } from '@/lib/firebase';
import Link from 'next/link';

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

export function GameCard({ game }: GameCardProps) {
    const [odds, setOdds] = React.useState<BookmakerOdds | null>(null);

    React.useEffect(() => {
        const db = getFirestore(getFirebaseApp());
        const oddsQuery = query(collection(db, `games/${game.id}/bookmaker_odds`), limit(1));
        
        const unsubscribe = onSnapshot(oddsQuery, (snapshot) => {
            if (!snapshot.empty) {
                const oddsData = snapshot.docs[0].data() as BookmakerOdds;
                setOdds(oddsData);
            }
        }, (error) => {
            console.error("Error fetching odds:", error);
        });

        return () => unsubscribe();

    }, [game.id]);

    const homeLogo = getTeamLogoUrl(game.home_team, game.sport_key);
    const awayLogo = getTeamLogoUrl(game.away_team, game.sport_key);

    const h2hMarket = odds?.markets.find(m => m.key === 'h2h');
    const awayTeamOdds = h2hMarket?.outcomes.find(o => o.name === game.away_team);
    const homeTeamOdds = h2hMarket?.outcomes.find(o => o.name === game.home_team);

    return (
        <Card 
            className="hover:shadow-lg transition-all duration-300 flex flex-col overflow-hidden cursor-pointer h-full"
        >
            <CardContent className="p-4 flex-grow flex flex-col items-center justify-center transition-all duration-300">
                 {game.commence_time && (
                     <div className="text-center text-muted-foreground text-sm w-full">
                        <p>{format(new Date(game.commence_time), "EEE, MMM d, h:mm a")}</p>
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

            <div className='p-2 bg-muted/50 text-center'>
                <Button variant="ghost" className="w-full font-bold h-12 text-base">
                    <Swords className="mr-2" />
                    View Odds & Challenges
                </Button>
            </div>
        </Card>
    );
}
