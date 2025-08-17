
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getFirebaseApp } from '@/lib/firebase';

type Game = {
    id: string;
    commence_time: string;
    home_team: string;
    away_team: string;
    bookmakers: {
        key: string;
        title: string;
        last_update: string;
        markets: {
            key: 'h2h';
            outcomes: { name: string; price: number }[];
        }[];
    }[];
};

const functions = getFunctions(getFirebaseApp());
const getUpcomingOddsFn = httpsCallable(functions, 'getUpcomingOdds');


export default function OddsCheckerPage() {
    const [games, setGames] = useState<Game[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleFetchGames = async () => {
        setLoading(true);
        setError(null);
        try {
            const result: any = await getUpcomingOddsFn();
            const fetchedGames = result.data;
            if (!fetchedGames || fetchedGames.length === 0) {
                setError("No upcoming games found or there was an error fetching data.");
            }
            setGames(fetchedGames);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };
    
    const getOddsDisplay = (game: Game) => {
        const bookmaker = game.bookmakers?.[0]; // Use first available bookmaker
        if (!bookmaker) return "N/A";

        const h2hMarket = bookmaker.markets.find(market => market.key === 'h2h');
        if (!h2hMarket) return "N/A";
        
        const homeOutcome = h2hMarket.outcomes.find(o => o.name === game.home_team);
        const awayOutcome = h2hMarket.outcomes.find(o => o.name === game.away_team);

        if (homeOutcome && awayOutcome) {
            const homeOdds = homeOutcome.price > 0 ? `+${homeOutcome.price}` : homeOutcome.price;
            const awayOdds = awayOutcome.price > 0 ? `+${awayOutcome.price}` : awayOutcome.price;
            return `${awayOdds} / ${homeOdds}`;
        }
        return "N/A";
    };

    return (
        <main className="container mx-auto p-4 md:p-8">
            <Card>
                <CardHeader>
                    <CardTitle>Developer: Odds API Checker</CardTitle>
                    <CardDescription>
                        This page directly calls The Odds API via the `getUpcomingOdds` Cloud Function to demonstrate data fetching.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button onClick={handleFetchGames} disabled={loading}>
                        {loading && <Loader2 className="mr-2 animate-spin" />}
                        Fetch Upcoming Games
                    </Button>
                    
                    {error && <p className="mt-4 text-destructive">{error}</p>}

                    {games.length > 0 && (
                        <Table className="mt-4">
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Matchup</TableHead>
                                    <TableHead>Time (Local)</TableHead>
                                    <TableHead>Sample Odds (Away/Home)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {games.map(game => (
                                    <TableRow key={game.id}>
                                        <TableCell className="font-medium">{game.away_team} @ {game.home_team}</TableCell>
                                        <TableCell>{new Date(game.commence_time).toLocaleString()}</TableCell>
                                        <TableCell>{getOddsDisplay(game)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </main>
    );
}

    
