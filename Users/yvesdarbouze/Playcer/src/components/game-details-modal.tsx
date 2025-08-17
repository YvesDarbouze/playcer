
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

interface GameDetailsModalProps {
    game: Game;
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
}


export function GameDetailsModal({ game, isOpen, onOpenChange }: GameDetailsModalProps) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [odds, setOdds] = useState<BookmakerOdds[]>([]);
  const [loadingOdds, setLoadingOdds] = useState(true);
  const [isBetModalOpen, setIsBetModalOpen] = useState(false);

  useEffect(() => {
    if (!game) return;

    setLoadingOdds(true);
    const db = getFirebaseApp();
    const oddsQuery = query(collection(db, `games/${game.id}/bookmaker_odds`));
    const unsubscribe = onSnapshot(oddsQuery, (snapshot) => {
        if (!snapshot.empty) {
            setOdds(snapshot.docs.map(d => d.data() as BookmakerOdds));
        }
        setLoadingOdds(false);
    }, (error) => {
        console.error("Error fetching odds:", error);
        setLoadingOdds(false);
    });

    return () => unsubscribe();
  }, [game]);
  
  const handleCreateBetClick = () => {
    if (!user) {
        router.push('/signin');
    } else {
        setIsBetModalOpen(true);
    }
  }

  if (!game) {
    return null;
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
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
          <DialogContent className="max-w-4xl h-5/6 flex flex-col">
              <DialogHeader>
                    <DialogTitle className="text-4xl font-headline font-black">{game.away_team} @ {game.home_team}</DialogTitle>
                     {game.commence_time ? (
                        <DialogDescription className="text-muted-foreground">
                            {format(new Date(game.commence_time), "EEEE, MMMM d, yyyy 'at' h:mm a")}
                        </DialogDescription>
                        ) : (
                        <Skeleton className="h-6 w-72 mt-1" />
                    )}
              </DialogHeader>
              <div className="flex-grow overflow-y-auto pr-4">
                 <div className="grid md:grid-cols-1 gap-8">
                    <Card>
                        <CardHeader>
                        <CardTitle className="font-bold">Head-to-Head Odds Comparison</CardTitle>
                        <CardDescription>Odds from various sportsbooks. Odds update in real-time.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {loadingOdds ? <Skeleton className="h-24" /> : (
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
                            )}
                        </CardContent>
                    </Card>
                </div>
              </div>
               <div className="mt-auto pt-4 border-t">
                    <Button size="lg" onClick={handleCreateBetClick} disabled={authLoading} className="w-full">
                        <PlusCircle className="mr-2" />
                        Create Challenge
                    </Button>
               </div>
          </DialogContent>
      </Dialog>
      
      {game && (
          <BetCreationModal 
            isOpen={isBetModalOpen}
            onOpenChange={setIsBetModalOpen}
            game={game}
            odds={odds}
            loadingOdds={loadingOdds}
          />
      )}
    </>
  );
}
