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

const OddsDisplay = ({ label, value, point }: { label: string, value: number, point?: number }) => (
    <div className="flex justify-between items-center text-sm p-2 rounded-md hover:bg-muted">
        <div className='flex items-center gap-1'>
            {point !== undefined && <span className={cn("font-bold", point > 0 ? "text-green-500" : "text-red-500")}>{point > 0 ? `O ${point}` : `U ${point * -1}`}</span>}
            <p className="text-muted-foreground">{label}</p>
        </div>
        <p className="font-mono font-bold text-primary">{value > 0 ? `+${value}` : value}</p>
    </div>
)


export function GameCard({ game }: GameCardProps) {
    const [isModalOpen, setIsModalOpen] = React.useState(false);
    const [isExpanded, setIsExpanded] = React.useState(false);
    const { user, loading } = useAuth();
    const { toast } = useToast();
    const router = useRouter();
    const [gameTime, setGameTime] = React.useState<Date | null>(null);
    const [odds, setOdds] = React.useState<BookmakerOdds | null>(null);
    const [loadingOdds, setLoadingOdds] = React.useState(true);


    React.useEffect(() => {
        setGameTime(new Date(game.commence_time));

        if (!user) {
            setLoadingOdds(false);
            return;
        };

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

    }, [game.commence_time, game.id, user]);

    const handleCreateBetClick = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent card from toggling expansion
        if (!user && !loading) {
            router.push('/signin');
        } else if (user) {
            setIsModalOpen(true);
        }
    };

    const homeLogo = getTeamLogoUrl(game.home_team, game.sport_key);
    const awayLogo = getTeamLogoUrl(game.away_team, game.sport_key);

    const h2hMarket = odds?.markets.find(m => m.key === 'h2h');
    const spreadsMarket = odds?.markets.find(m => m.key === 'spreads');
    const totalsMarket = odds?.markets.find(m => m.key === 'totals');

    const handleCardClick = () => {
        if (user) {
            setIsExpanded(!isExpanded);
        } else {
            router.push('/signin');
        }
    };

    return (
        <>
            <Card 
                className={cn(
                    "hover:shadow-lg transition-all duration-300 flex flex-col overflow-hidden cursor-pointer",
                    isExpanded ? "row-span-2" : "aspect-square"
                )}
                onClick={handleCardClick}
            >
                <CardContent className={cn("p-4 flex-grow flex flex-col items-center justify-center transition-all duration-300", isExpanded && "justify-start")}>
                    {/* Collapsed View */}
                    <div className={cn("flex flex-col items-center justify-center text-center w-full", isExpanded ? 'flex-row justify-between' : 'flex-grow')}>
                         <div className={cn("flex items-center gap-2 text-center", isExpanded ? "flex-col w-2/5" : "justify-around w-full")}>
                            <div className="flex flex-col items-center gap-2 text-center w-2/5">
                                <Image src={awayLogo} alt={`${game.away_team} logo`} width={80} height={80} className={cn("h-16 w-auto transition-all", isExpanded && "h-20")}/>
                                <p className="font-bold text-sm truncate">{game.away_team}</p>
                            </div>
                            <div className="text-muted-foreground font-bold text-2xl">@</div>
                            <div className="flex flex-col items-center gap-2 text-center w-2/5">
                                <Image src={homeLogo} alt={`${game.home_team} logo`} width={80} height={80} className={cn("h-16 w-auto transition-all", isExpanded && "h-20")}/>
                                <p className="font-bold text-sm truncate">{game.home_team}</p>
                            </div>
                        </div>
                        {isExpanded && <Separator orientation="vertical" className="h-24" />}

                        {isExpanded && gameTime && (
                             <div className="text-center text-muted-foreground text-sm">
                                <p className="font-bold text-base">{format(gameTime, "EEE, MMM d")}</p>
                                <p className="font-semibold text-lg">{format(gameTime, "h:mm a")}</p>
                            </div>
                        )}
                    </div>

                    {!isExpanded && gameTime && (
                         <div className="text-center text-muted-foreground text-sm mt-4">
                            <p>{format(gameTime, "EEE, MMM d")}</p>
                            <p className="font-semibold">{format(gameTime, "h:mm a")}</p>
                        </div>
                    )}
                    
                    {/* Expanded View */}
                    {isExpanded && (
                        <div className="w-full mt-4 space-y-4">
                             <Separator />
                             {loadingOdds ? (
                                <div className="flex justify-center items-center p-4">
                                    <Loader2 className="animate-spin text-primary" />
                                </div>
                             ) : !odds ? (
                                 <p className="text-center text-muted-foreground p-4">Odds not available for this game yet.</p>
                             ) : (
                                 <div className="space-y-2">
                                     {h2hMarket && <OddsDisplay label="Moneyline" value={h2hMarket.outcomes.find(o => o.name === game.home_team)?.price!} />}
                                     {spreadsMarket && <OddsDisplay label={`Spread (${spreadsMarket.outcomes.find(o => o.name === game.home_team)?.point})`} value={spreadsMarket.outcomes.find(o => o.name === game.home_team)?.price!} />}
                                     {totalsMarket && <OddsDisplay label="Total" point={totalsMarket.outcomes[0].point} value={totalsMarket.outcomes[0].price} />}
                                 </div>
                             )}
                            <Button onClick={handleCreateBetClick} disabled={loading} className="w-full">
                                <Swords className="mr-2 h-4 w-4" />
                                {loading ? 'Checking Auth...' : 'Create Bet on this Game'}
                            </Button>
                        </div>
                    )}
                </CardContent>

                {!isExpanded && (
                     <div className='p-2 bg-muted/50 text-center text-sm font-medium text-primary cursor-pointer' onClick={handleCardClick}>
                        <Button variant="ghost" className="w-full">Bet</Button>
                    </div>
                )}
            </Card>
            {user && gameTime && (
                 <BetCreationModal
                    isOpen={isModalOpen}
                    onOpenChange={setIsModalOpen}
                    game={game}
                />
            )}
        </>
    );
}
