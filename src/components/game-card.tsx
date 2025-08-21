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
import { firestore } from '@/lib/firebase';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Skeleton } from './ui/skeleton';

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

const OddsValue = ({ value, previousValue }: { value: number, previousValue?: number }) => {
    const [flashColor, setFlashColor] = React.useState('');

    React.useEffect(() => {
        if (previousValue !== undefined && value !== previousValue) {
            const color = value > previousValue ? 'bg-green-500/30' : 'bg-red-500/30';
            setFlashColor(color);
            const timer = setTimeout(() => setFlashColor(''), 1000);
            return () => clearTimeout(timer);
        }
    }, [value, previousValue]);

    return (
        <p className={cn("font-mono text-sm transition-colors duration-300 p-1 rounded", flashColor)}>
            {value > 0 ? `+${value}` : value}
        </p>
    );
};

export function GameCard({ game }: GameCardProps) {
    const [odds, setOdds] = React.useState<BookmakerOdds | null>(null);
    const prevOddsRef = React.useRef<BookmakerOdds | null>(null);
    const [formattedDate, setFormattedDate] = React.useState<string | null>(null);
    
    React.useEffect(() => {
        prevOddsRef.current = odds;
    });
    const prevOdds = prevOddsRef.current;


    React.useEffect(() => {
        const oddsQuery = query(collection(firestore, `games/${game.id}/bookmaker_odds`), limit(1));
        
        const unsubscribe = onSnapshot(oddsQuery, (snapshot) => {
            if (!snapshot.empty) {
                const oddsData = snapshot.docs[0].data() as BookmakerOdds;
                setOdds(oddsData);
            }
        }, (error) => {
            console.error("Error fetching odds:", error);
        });

        // Format date on client-side to avoid hydration mismatch
        setFormattedDate(format(new Date(game.commence_time), "EEE, MMM d, h:mm a"));

        return () => unsubscribe();

    }, [game.id, game.commence_time]);

    const homeLogo = getTeamLogoUrl(game.home_team, game.sport_key);
    const awayLogo = getTeamLogoUrl(game.away_team, game.sport_key);

    const h2hMarket = odds?.markets.find(m => m.key === 'h2h');
    const awayTeamOdds = h2hMarket?.outcomes.find(o => o.name === game.away_team);
    const homeTeamOdds = h2hMarket?.outcomes.find(o => o.name === game.home_team);
    
    const prevH2hMarket = prevOdds?.markets.find(m => m.key === 'h2h');
    const prevAwayTeamOdds = prevH2hMarket?.outcomes.find(o => o.name === game.away_team);
    const prevHomeTeamOdds = prevH2hMarket?.outcomes.find(o => o.name === game.home_team);

    return (
        <Card 
            className="hover:shadow-lg transition-all duration-300 flex flex-col overflow-hidden h-full"
        >
             <Link href={`/game/${game.id}`} passHref className="flex-grow">
                <CardContent className="p-4 flex-grow flex flex-col items-center justify-center transition-all duration-300 cursor-pointer">
                    <div className="text-center text-muted-foreground text-sm w-full h-5">
                        {formattedDate ? <p>{formattedDate}</p> : <Skeleton className="h-5 w-3/4 mx-auto" />}
                    </div>
                    <div className="flex items-center justify-around text-center w-full flex-grow space-x-2 my-4">
                        <div className="flex flex-col items-center text-center">
                            <Image src={awayLogo} alt={`${game.away_team} logo`} width={80} height={80} className="h-16 w-auto transition-all"/>
                            <p className="font-bold text-lg mt-1">{game.away_team}</p>
                            {awayTeamOdds ? <OddsValue value={awayTeamOdds.price} previousValue={prevAwayTeamOdds?.price} /> : <Skeleton className="h-6 w-12 mt-1" />}
                        </div>
                        <div className="text-muted-foreground font-bold text-xl">@</div>
                        <div className="flex flex-col items-center text-center">
                            <Image src={homeLogo} alt={`${game.home_team} logo`} width={80} height={80} className="h-16 w-auto transition-all"/>
                            <p className="font-bold text-lg mt-1">{game.home_team}</p>
                            {homeTeamOdds ? <OddsValue value={homeTeamOdds.price} previousValue={prevHomeTeamOdds?.price} /> : <Skeleton className="h-6 w-12 mt-1" />}
                        </div>
                    </div>
                </CardContent>
            </Link>

            <div className='p-2 bg-muted/50 text-center'>
                <Link href={`/game/${game.id}`} passHref>
                    <Button variant="ghost" className="w-full font-bold h-12 text-base">
                        <Swords className="mr-2" />
                        View Odds & Challenges
                    </Button>
                </Link>
            </div>
        </Card>
    );
}
