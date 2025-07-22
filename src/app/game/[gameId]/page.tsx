
import { collection, doc, getDoc, getDocs, Timestamp } from "firebase/firestore";
import { firestore } from "@/lib/firebase-admin";
import { notFound } from "next/navigation";
import type { Game } from "@/types";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type BookmakerOdds = {
    key: string;
    title: string;
    last_update: string;
    markets: {
        key: "h2h";
        outcomes: { name: string; price: number }[];
    }[];
};

async function getGameDetails(gameId: string): Promise<Game | null> {
  const gameRef = doc(firestore, "games", gameId);
  const gameSnap = await getDoc(gameRef);
  if (!gameSnap.exists()) return null;

  const data = gameSnap.data();
  return {
    id: gameSnap.id,
    ...data,
    commence_time: (data.commence_time as Timestamp).toDate().toISOString(),
  } as unknown as Game;
}

async function getBookmakerOdds(gameId: string): Promise<BookmakerOdds[]> {
  const oddsRef = collection(firestore, `games/${gameId}/bookmaker_odds`);
  const oddsSnap = await getDocs(oddsRef);
  
  if (oddsSnap.empty) {
     return [
        { 
            key: 'draftkings', title: 'DraftKings', last_update: new Date().toISOString(), 
            markets: [{ key: 'h2h', outcomes: [{name: 'Team A', price: -110}, {name: 'Team B', price: -110}]}]
        },
        { 
            key: 'fanduel', title: 'FanDuel', last_update: new Date().toISOString(), 
            markets: [{ key: 'h2h', outcomes: [{name: 'Team A', price: -115}, {name: 'Team B', price: -105}]}]
        }
     ] as BookmakerOdds[];
  }
  
  return oddsSnap.docs.map(doc => doc.data() as BookmakerOdds);
}

export default async function GameDetailsPage({ params }: { params: { gameId: string } }) {
  const { gameId } = params;
  const [game, odds] = await Promise.all([
    getGameDetails(gameId),
    getBookmakerOdds(gameId),
  ]);

  if (!game) {
    notFound();
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
  }).filter(o => o.homePrice && o.awayPrice); // Only show bookmakers with odds for both teams


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
        <p className="text-muted-foreground">
          {format(new Date(game.commence_time), "EEEE, MMMM d, yyyy 'at' h:mm a")}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Head-to-Head Odds</CardTitle>
          <CardDescription>Odds from various sportsbooks. Best odds are highlighted.</CardDescription>
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
