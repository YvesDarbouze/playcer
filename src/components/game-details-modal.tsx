
"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, Timestamp, query } from "firebase/firestore";
import { getFirebaseApp } from "@/lib/firebase";
import type { Game } from "@/types";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { BetCreationModal } from "@/components/bet-creation-modal";
import { useRouter } from "next/navigation";
import { ConsensusOddsDisplay } from "@/components/consensus-odds-display";
import { getFunctions, httpsCallable } from "firebase/functions";

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

interface GameDetailsModalProps {
    game: Game;
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
}


export function GameDetailsModal({ game, isOpen, onOpenChange }: GameDetailsModalProps) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [odds, setOdds] = useState<BookmakerOdds[]>([]);
  const [consensusData, setConsensusData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingConsensus, setLoadingConsensus] = useState(true);
  const [isBetModalOpen, setIsBetModalOpen] = useState(false);
  const [selectedBet, setSelectedBet] = useState<SelectedBet | null>(null);

  useEffect(() => {
    if (!game) return;

    setLoading(true);
    const db = getFirebaseApp();
    const functions = getFunctions(db.app);

    const fetchConsensusOdds = async () => {
        setLoadingConsensus(true);
        const getConsensusOddsFn = httpsCallable(functions, 'getConsensusOdds');
        try {
            const result: any = await getConsensusOddsFn({ gameId: game.id });
            if (result.data.success) {
                setConsensusData(result.data.data);
            }
        } catch (error) {
            console.error("Error fetching consensus odds:", error);
        } finally {
            setLoadingConsensus(false);
        }
    }

    fetchConsensusOdds();

    const oddsQuery = query(collection(db, `games/${game.id}/bookmaker_odds`));
    const unsubscribe = onSnapshot(oddsQuery, (snapshot) => {
        if (!snapshot.empty) {
            setOdds(snapshot.docs.map(d => d.data() as BookmakerOdds));
        }
        setLoading(false);
    }, (error) => {
        console.error("Error fetching odds:", error);
        setLoading(false);
    });

    return () => unsubscribe();
  }, [game]);
  
  const handleCreateBetClick = (betDetails: SelectedBet) => {
    if (!user) {
        router.push('/signin');
    } else {
        setSelectedBet(betDetails);
        setIsBetModalOpen(true);
    }
  }

  if (!game) {
    return null;
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
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
          <DialogContent className="max-w-4xl h-5/6 flex flex-col">
              <DialogHeader>
                <DialogTitle className="text-4xl font-headline font-black">{game.away_team} @ {game.home_team}</DialogTitle>
                    {game.commence_time ? (
                    <DialogDescription className="text-muted-foreground">
                        {format(new Date(game.commence_time), "EEEE, MMMM d, yyyy 'at' h:mm a zzz")}
                    </DialogDescription>
                    ) : (
                    <Skeleton className="h-6 w-72 mt-1" />
                )}
              </DialogHeader>
              <div className="flex-grow overflow-y-auto pr-4 space-y-8">
                 <ConsensusOddsDisplay consensusData={consensusData} loading={loadingConsensus} />
                 
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
          </DialogContent>
      </Dialog>
      
      {game && selectedBet && (
          <BetCreationModal 
            isOpen={isBetModalOpen}
            onOpenChange={setIsBetModalOpen}
            game={game}
            selectedBet={selectedBet}
          />
      )}
    </>
  );
}
