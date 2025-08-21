
"use client";

import { useEffect, useState } from "react";
import { collection, doc, getDoc, onSnapshot, Timestamp, query } from "firebase/firestore";
import { getFirebaseApp } from "@/lib/firebase";
import { getFunctions, httpsCallable } from "firebase/functions";
import type { Game, User } from "@/types";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { BetCreationModal } from "@/components/bet-creation-modal";
import { useRouter } from "next/navigation";
import { ConsensusOddsDisplay } from "@/components/consensus-odds-display";

type BookmakerOdds = {
    key: string;
    title: string;
    last_update: string;
    markets: {
        key: "h2h" | "spreads" | "totals";
        outcomes: { name: string; price: number, point?: number }[];
    }[];
};

type SelectedBet = {
    betType: "moneyline" | "spread" | "totals";
    chosenOption: string;
    line?: number;
    odds: number;
    bookmakerKey: string;
}

export default function GameDetailsPage({ params }: { params: { gameId: string } }) {
  const { gameId } = params;
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [game, setGame] = useState<Game | null>(null);
  const [odds, setOdds] = useState<BookmakerOdds[]>([]);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [consensusData, setConsensusData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingConsensus, setLoadingConsensus] = useState(true);
  const [isBetModalOpen, setIsBetModalOpen] = useState(false);
  const [selectedBet, setSelectedBet] = useState<SelectedBet | null>(null);

  useEffect(() => {
    if (!gameId) return;

    const db = getFirebaseApp();
    const functions = getFunctions(db.app);

    const fetchGameDetails = async () => {
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
      }
      setLoading(false);
    };

     const fetchUserProfile = async () => {
        if (!user) return;
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
            setUserProfile(userDocSnap.data() as User);
        }
    };

    const fetchConsensusOdds = async () => {
        setLoadingConsensus(true);
        const getConsensusOddsFn = httpsCallable(functions, 'getConsensusOdds');
        try {
            const result: any = await getConsensusOddsFn({ gameId });
            if (result.data.success) {
                setConsensusData(result.data.data);
            }
        } catch (error) {
            console.error("Error fetching consensus odds:", error);
        } finally {
            setLoadingConsensus(false);
        }
    }

    fetchGameDetails();
    fetchConsensusOdds();
    if(user) fetchUserProfile();

    const oddsQuery = query(collection(db, `games/${gameId}/bookmaker_odds`));
    const unsubscribe = onSnapshot(oddsQuery, (snapshot) => {
        if (!snapshot.empty) {
            setOdds(snapshot.docs.map(d => d.data() as BookmakerOdds));
        }
    }, (error) => {
        console.error("Error fetching odds:", error);
    });

    return () => unsubscribe();
  }, [gameId, user]);
  
  const handleCreateBetClick = (betDetails: SelectedBet) => {
    if (!user) {
        router.push('/signin');
    } else {
        setSelectedBet(betDetails);
        setIsBetModalOpen(true);
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

  const renderOddsButton = (outcome: any, betType: SelectedBet['betType'], bookmakerKey: string) => {
      if(!outcome || !outcome.price) return <TableCell className="text-center">-</TableCell>;
      return (
          <TableCell className="text-center">
              <Button 
                variant="outline"
                className="w-full font-bold"
                onClick={() => handleCreateBetClick({
                    betType,
                    chosenOption: outcome.name,
                    line: outcome.point,
                    odds: outcome.price,
                    bookmakerKey
                })}
              >
                {outcome.point && <span className="text-muted-foreground mr-2">{outcome.point > 0 ? `+${outcome.point}`: outcome.point}</span>}
                {outcome.price > 0 ? `+${outcome.price}` : outcome.price}
              </Button>
          </TableCell>
      )
  }

  return (
    <>
    <main className="container mx-auto p-4 md:p-8">
      <header className="mb-8">
        <Link href={`/`} passHref>
          <Button variant="outline" className="mb-4">
            <ArrowLeft className="mr-2" />
            Back to All Games
          </Button>
        </Link>
        <h1 className="text-4xl font-headline font-black">{game.away_team} @ {game.home_team}</h1>
        <p className="text-muted-foreground">
            {format(new Date(game.commence_time), "EEEE, MMMM d, yyyy 'at' h:mm a zzz")}
        </p>
      </header>

       <div className="mb-8">
           <ConsensusOddsDisplay consensusData={consensusData} loading={loadingConsensus} />
       </div>

       <div className="grid md:grid-cols-1 gap-8">
            <Card>
                <CardHeader>
                <CardTitle className="font-bold">Moneyline</CardTitle>
                <CardDescription>Odds to win the game outright. Click an odd to place a bet.</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? <Skeleton className="h-24" /> : (
                         <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Bookmaker</TableHead>
                                    <TableHead className="text-center">{game.away_team}</TableHead>
                                    <TableHead className="text-center">{game.home_team}</TableHead>
                                </TableRow>
                            </TableHeader>
                             <TableBody>
                                {odds.map(bookie => {
                                    const h2hMarket = bookie.markets.find(m => m.key === 'h2h');
                                    const awayOutcome = h2hMarket?.outcomes.find(o => o.name === game.away_team);
                                    const homeOutcome = h2hMarket?.outcomes.find(o => o.name === game.home_team);
                                    return (
                                        <TableRow key={`h2h-${bookie.key}`}>
                                            <TableCell className="font-medium">{bookie.title}</TableCell>
                                            {renderOddsButton(awayOutcome, "moneyline", bookie.key)}
                                            {renderOddsButton(homeOutcome, "moneyline", bookie.key)}
                                        </TableRow>
                                    )
                                })}
                             </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                <CardTitle className="font-bold">Point Spread</CardTitle>
                <CardDescription>Odds based on the margin of victory.</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? <Skeleton className="h-24" /> : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Bookmaker</TableHead>
                                    <TableHead className="text-center">{game.away_team}</TableHead>
                                    <TableHead className="text-center">{game.home_team}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {odds.map(bookie => {
                                    const spreadMarket = bookie.markets.find(m => m.key === 'spreads');
                                    if (!spreadMarket) return null;
                                    const awayOutcome = spreadMarket.outcomes.find(o => o.name === game.away_team);
                                    const homeOutcome = spreadMarket.outcomes.find(o => o.name === game.home_team);
                                    return (
                                        <TableRow key={`spread-${bookie.key}`}>
                                            <TableCell className="font-medium">{bookie.title}</TableCell>
                                            {renderOddsButton(awayOutcome, "spread", bookie.key)}
                                            {renderOddsButton(homeOutcome, "spread", bookie.key)}
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

             <Card>
                <CardHeader>
                <CardTitle className="font-bold">Totals (Over/Under)</CardTitle>
                <CardDescription>Odds based on the total points scored in the game.</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? <Skeleton className="h-24" /> : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Bookmaker</TableHead>
                                    <TableHead className="text-center">Over</TableHead>
                                    <TableHead className="text-center">Under</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {odds.map(bookie => {
                                    const totalMarket = bookie.markets.find(m => m.key === 'totals');
                                    if (!totalMarket) return null;
                                    const overOutcome = totalMarket.outcomes.find(o => o.name === 'Over');
                                    const underOutcome = totalMarket.outcomes.find(o => o.name === 'Under');
                                    return (
                                        <TableRow key={`totals-${bookie.key}`}>
                                            <TableCell className="font-medium">{bookie.title}</TableCell>
                                            {renderOddsButton({ ...overOutcome, name: 'Over'}, "totals", bookie.key)}
                                            {renderOddsButton({ ...underOutcome, name: 'Under'}, "totals", bookie.key)}
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
      </main>
      
      {game && selectedBet && (
          <BetCreationModal 
            isOpen={isBetModalOpen}
            onOpenChange={setIsBetModalOpen}
            game={game}
            selectedBet={selectedBet}
            userProfile={userProfile}
          />
      )}
    </>
  );
}
