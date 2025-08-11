
"use client";

import { useEffect, useState } from "react";
import { collection, doc, getDoc, onSnapshot, Timestamp, query, limit } from "firebase/firestore";
import { getFirebaseApp } from "@/lib/firebase";
import type { Game } from "@/types";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, PlusCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { BetCreationModal } from "@/components/bet-creation-modal";
import { useRouter } from "next/navigation";

type BookmakerOdds = {
    key: string;
    title: string;
    last_update: string;
    markets: {
        key: "h2h" | "spreads" | "totals";
        outcomes: { name: string; price: number, point?: number }[];
    }[];
};

export default function GameDetailsPage({ params }: { params: { gameId: string } }) {
  const { gameId } = params;
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [game, setGame] = useState<Game | null>(null);
  const [odds, setOdds] = useState<BookmakerOdds | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingOdds, setLoadingOdds] = useState(true);
  const [gameTime, setGameTime] = useState<Date | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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
    const oddsQuery = query(collection(db, `games/${gameId}/bookmaker_odds`), limit(1));
    const unsubscribe = onSnapshot(oddsQuery, (snapshot) => {
        if (!snapshot.empty) {
            setOdds(snapshot.docs[0].data() as BookmakerOdds);
        }
        setLoadingOdds(false);
    }, (error) => {
        console.error("Error fetching odds:", error);
        setLoadingOdds(false);
    });

    return () => unsubscribe();
  }, [gameId]);
  
  const handleCreateBetClick = () => {
    if (!user) {
        router.push('/signin');
    } else {
        setIsModalOpen(true);
    }
  }

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
  
  const h2hOdds = odds?.markets.find(m => m.key === 'h2h');

  return (
    <>
      <main className="container mx-auto p-4 md:p-8">
        <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
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
            </div>
             <Button size="lg" onClick={handleCreateBetClick} disabled={authLoading}>
                <PlusCircle className="mr-2" />
                Create Challenge
            </Button>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="font-bold">Head-to-Head Odds</CardTitle>
            <CardDescription>Odds from various sportsbooks. Odds update in real-time.</CardDescription>
          </CardHeader>
          <CardContent>
              {loadingOdds ? (
                 <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                </div>
              ) : h2hOdds ? (
                  <Table>
                      <TableHeader>
                          <TableRow>
                              <TableHead className="text-center">{game.away_team}</TableHead>
                              <TableHead className="text-center">{game.home_team}</TableHead>
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                          <TableRow>
                              <TableCell className="text-center font-bold text-lg">{h2hOdds.outcomes.find(o => o.name === game.away_team)?.price}</TableCell>
                              <TableCell className="text-center font-bold text-lg">{h2hOdds.outcomes.find(o => o.name === game.home_team)?.price}</TableCell>
                          </TableRow>
                      </TableBody>
                  </Table>
              ) : (
                  <p className="text-muted-foreground text-center p-8">No odds available for this game yet.</p>
              )}
          </CardContent>
        </Card>
      </main>
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
