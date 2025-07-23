"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

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

async function fetchUpcomingOdds() {
    // NOTE: This API key is for demonstration purposes and will be disabled.
    // In your real app, the API key is stored securely as a secret and used in a Cloud Function.
    const apiKey = '9506477182d2f2335317a695b5e875e4';
    const sportKey = 'upcoming'; // Using a broad key for demonstration
    const regions = 'us';
    const markets = 'h2h';
    const oddsFormat = 'american';
    const dateFormat = 'iso';
    const apiUrl = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds?apiKey=${apiKey}&regions=${regions}&markets=${markets}&oddsFormat=${oddsFormat}&dateFormat=${dateFormat}`;

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error(`Failed to get odds: status_code ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching odds data:', error);
        return []; // Return empty array on error
    }
}


export default function OddsCheckerPage() {
    const [games, setGames] = useState<Game[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleFetchGames = async () => {
        setLoading(true);
        setError(null);
        try {
            const fetchedGames = await fetchUpcomingOdds();
            if (!fetchedGames || fetchedGames.length === 0) {
                setError("No upcoming games found or there was an error.");
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
                        This page directly calls The Odds API to demonstrate the fetching logic you provided.
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
                                    <TableHead>Odds (Away/Home)</TableHead>
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
