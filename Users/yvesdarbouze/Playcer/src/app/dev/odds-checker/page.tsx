
"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getFirebaseApp } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, Timestamp } from "firebase/firestore";
import type { Game } from '@/types';
import { format } from "date-fns";


const getGames = async (): Promise<Game[]> => {
    const db = getFirebaseApp();
    const gamesRef = collection(db, "games");
    const q = query(
      gamesRef,
      orderBy("commence_time", "asc")
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        commence_time: (data.commence_time as Timestamp).toDate().toISOString(),
      } as unknown as Game;
    });
};


export default function OddsCheckerPage() {
    const [games, setGames] = useState<Game[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleFetchGames = async () => {
        setLoading(true);
        setError(null);
        try {
            const fetchedGames = await getGames();
            if (!fetchedGames || fetchedGames.length === 0) {
                setError("No upcoming games found in Firestore.");
            }
            setGames(fetchedGames);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };
    
    const getOddsDisplay = (game: Game) => {
        // This is a simplified display. A real app might show more complex odds.
        return "N/A";
    };

    return (
        <main className="container mx-auto p-4 md:p-8">
            <Card>
                <CardHeader>
                    <CardTitle>Developer: Firestore Game Checker</CardTitle>
                    <CardDescription>
                        This page fetches the game data directly from your Firestore database to verify ingestion from the SportsGameOdds API is working.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button onClick={handleFetchGames} disabled={loading}>
                        {loading && <Loader2 className="mr-2 animate-spin" />}
                        Fetch Games from Firestore
                    </Button>
                    
                    {error && <p className="mt-4 text-destructive">{error}</p>}

                    {games.length > 0 && (
                        <Table className="mt-4">
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Matchup</TableHead>
                                    <TableHead>Time (Local)</TableHead>
                                    <TableHead>Sport</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {games.map(game => (
                                    <TableRow key={game.id}>
                                        <TableCell className="font-medium">{game.away_team} @ {game.home_team}</TableCell>
                                        <TableCell>{format(new Date(game.commence_time), "PPpp")}</TableCell>
                                        <TableCell>{game.sport_title}</TableCell>
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

    