
"use client";

import { useEffect, useState } from "react";
import { collection, doc, getDoc, onSnapshot, Timestamp } from "firebase/firestore";
import { getFirebaseApp } from "@/lib/firebase";
import type { Game } from "@/types";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type BookmakerOdds = {
    key: string;
    title: string;
    last_update: string;
    markets: {
        key: "h2h";
        outcomes: { name: string; price: number }[];
    }[];
};

export default function GameDetailsPage({ params }: { params: { gameId: string } }) {
  const { gameId } = params;
  const [game, setGame] = useState<Game | null>(null);
  const [odds, setOdds] = useState<BookmakerOdds[]>([]);
  const [loading, setLoading] = useState(true);
  const [gameTime, setGameTime] = useState<Date | null>(null);

  useEffect(() => {
    const fetchGameDetails = async () => {
      const db = getFirebaseApp();
      const gameRef = doc(db, "games", gameId);
      const gameSnap = await getDoc(gameRef);

      if (gameSnap.exists()) {
        const data = gameSnap.data();
        const gameData = {
          id: gameSnap.id,
          ...data,
          commence_time: (data.commence_time as Timestamp).toDate().toISOString(),
        } as unknown as Game;
        setGame(gameData);
        setGameTime(new Date(gameData.commence_time));
      }
      setLoading(false);
    };

    fetchGameDetails();

    const db = getFirebaseApp();
    const oddsRef = collection(db, `games/${gameId}/bookmaker_odds`);
    const unsubscribe = onSnapshot(oddsRef, (snapshot) => {
        const oddsData = snapshot.docs.map(doc => doc.data() as BookmakerOdds);
        
        // Handle mock data case if listener returns empty
        if (oddsData.length === 0) {
            setOdds([
                { 
                    key: 'draftkings', title: 'DraftKings', last_update: new Date().toISOString(), 
                    markets: [{ key: 'h2h', outcomes: [{name: 'Team A', price: -110}, {name: 'Team B', price: -110}]}]
                },
                { 
                    key: 'fanduel', title: 'FanDuel', last_update: new Date().toISOString(), 
                    markets: [{ key: 'h2h', outcomes: [{name: 'Team A', price: -115}, {name: 'Team B', price: -105}]}]
                }
            ] as BookmakerOdds[]);
        } else {
            setOdds(oddsData);
        }
    });

    return () => unsubscribe();
  }, [gameId]);
  
  if (loading) {
     return (
        <main className="container mx-auto p-4 md:p-8">
             <Skeleton className="h-10 w-48 mb-4" />
             <Skeleton className="h-12 w-96 mb-2" />
             <Skeleton className="h-6 w-72 mb-8" />
             <Card>
                <CardHeader>
                    <Skeleton className="h-8 w-1/2" />
                    <Skeleton className="h-4 w-3/4" />
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                    </div>
                </CardContent>
            </Card>
        </main>
    );
  }

  if (!game) {
    return <p className="text-center p-8">Game not found.</p>;
  }
  
  const h2hOdds = odds.map(bookmaker => {
    const h2hMarket = bookmaker.markets.find(m => m.key === 'h2h');
    const homeOutcome = h2hMarket?.outcomes.find(o => o.name === game.home_team);
    const awayOutcome = h2hMarket?.outcomes.find(o => o.name === game.away_team);
    return {
        title: bookmaker.title,
        homePrice: homeOutcome?.price,
        awayPrice: awayOutcome?.price,
    }
  }).filter(o => o.homePrice && o.awayPrice);


  return (
    <main className="container mx-auto p-4 md:p-8">
      <header className="mb-8">
        <Link href={`/sport/${game.sport_key}`} passHref>
          <Button variant="outline" className="mb-4">
            <ArrowLeft className="mr-2" />
            Back to {game.sport_title}
          </Button>
        </Link>
        <h1 className="text-4xl font-headline font-black">{game.away_team} @ {game.home_team}</h1>
        {gameTime ? (
          <p className="text-muted-foreground">
            {format(gameTime, "EEEE, MMMM d, yyyy 'at' h:mm a")}
          </p>
        ) : (
          <Skeleton className="h-6 w-72 mt-1" />
        )}
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="font-bold">Head-to-Head Odds</CardTitle>
          <CardDescription>Odds from various sportsbooks. Odds update in real-time.</CardDescription>
        </CardHeader>
        <CardContent>
            {h2hOdds.length > 0 ? (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Bookmaker</TableHead>
                            <TableHead className="text-center">{game.away_team}</TableHead>
                            <TableHead className="text-center">{game.home_team}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {h2hOdds.map(bookie => (
                            <TableRow key={bookie.title}>
                                <TableCell className="font-medium">{bookie.title}</TableCell>
                                <TableCell className="text-center font-bold">{bookie.awayPrice}</TableCell>
                                <TableCell className="text-center font-bold">{bookie.homePrice}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            ) : (
                <p className="text-muted-foreground text-center p-8">No odds available for this game yet.</p>
            )}
        </CardContent>
      </Card>
    </main>
  );
}
