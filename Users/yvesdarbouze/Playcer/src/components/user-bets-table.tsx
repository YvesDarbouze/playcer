
"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Bet } from "@/types";
import { format } from "date-fns";
import { ArrowUpRight, Twitter, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import * as React from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "@/lib/firebase";

interface UserBetsTableProps {
  bets: Bet[];
  currentUserId: string;
  onBetAction?: () => void; // Callback to refresh data after an action
}

const OpponentDisplay = ({ bet, currentUserId }: { bet: Bet, currentUserId: string }) => {
    const isChallenger = bet.challengerId === currentUserId;
    
    if (bet.isPublic && bet.accepters.length === 0) {
        return <span className="text-muted-foreground">vs. Public</span>;
    }

    if (bet.accepters.length === 1) {
        const opponent = bet.accepters[0];
         return (
            <Link href={`/profile/${opponent.accepterId}`} className="flex items-center gap-2 hover:underline">
                <Avatar className="size-6">
                    <AvatarImage src={opponent.accepterPhotoURL || undefined} alt={opponent.accepterUsername || ''} />
                    <AvatarFallback>{opponent.accepterUsername ? opponent.accepterUsername.charAt(0) : '?'}</AvatarFallback>
                </Avatar>
                <span className="font-medium">@{opponent.accepterUsername}</span>
            </Link>
        )
    }

    if (bet.accepters.length > 1) {
        return <span className="text-muted-foreground">vs. Multiple</span>
    }
    
    return <span className="text-muted-foreground">vs. Private</span>
}

const OutcomeBadge = ({ bet, currentUserId }: { bet: Bet, currentUserId: string }) => {
    if (bet.status !== 'settled') return null;
    if (bet.outcome === 'draw') return <Badge variant="secondary">Push</Badge>;

    if (!bet.winnerId) {
        return <Badge variant="secondary">?</Badge>;
    }

    const isWinner = bet.winnerId === currentUserId;

    if (isWinner) {
        return <Badge variant="default" className="bg-green-500 hover:bg-green-600">Win</Badge>
    }
    
    return <Badge variant="destructive">Loss</Badge>
}

const BetValueDisplay = ({ bet }: { bet: Bet }) => {
    const { chosenOption, betType, line } = bet;
    if (betType === 'moneyline') {
      return <>{chosenOption}</>;
    }
    if (betType === 'spread') {
      return <>{`${chosenOption} ${line! > 0 ? `+${line}` : line}`}</>;
    }
    if (betType === 'totals') {
      return <>{`Total ${chosenOption} ${line}`}</>;
    }
    return <>{chosenOption || 'N/A'}</>;
}

export function UserBetsTable({ bets, currentUserId, onBetAction }: UserBetsTableProps) {
  const { toast } = useToast();
  const [isCanceling, setIsCanceling] = React.useState<Record<string, boolean>>({});
  
  const functions = getFunctions(app);
  const cancelBetFn = httpsCallable(functions, "cancelBet");

  const handleShareLink = (bet: Bet) => {
    const shareUrl = bet.twitterShareUrl || `https://twitter.com/intent/tweet?text=${encodeURIComponent(`I just posted a public challenge on Playcer for ${bet.awayTeam} @ ${bet.homeTeam}. Who wants to accept?`)}&url=${window.location.origin}/bet/${bet.id}`;
    window.open(shareUrl, '_blank');
    toast({ title: "Opening Twitter to share challenge!" });
  };
  
  const handleCancelBet = async (betId: string) => {
      if (!window.confirm("Are you sure you want to cancel this bet? This cannot be undone.")) {
          return;
      }
      setIsCanceling(prev => ({ ...prev, [betId]: true }));
      try {
          const result = await cancelBetFn({ betId });
          if(result.data) { // Check if result.data is not null/undefined
            toast({
                title: "Bet Canceled",
                description: "Your bet has been successfully canceled.",
            });
            if (onBetAction) onBetAction();
          } else {
             throw new Error("Failed to cancel bet. Please try again.");
          }
      } catch (error: any) {
          toast({
              title: "Error",
              description: error.message || "An unexpected error occurred.",
              variant: "destructive",
          });
      } finally {
          setIsCanceling(prev => ({ ...prev, [betId]: false }));
      }
  }
  
  if (bets.length === 0) {
    return (
        <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
                No bets found in this category.
            </CardContent>
        </Card>
    )
  }
  
  const isCancelable = (bet: Bet) => {
      return bet.challengerId === currentUserId && bet.status === 'pending' && bet.accepters.length === 0;
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Event</TableHead>
              <TableHead>Opponent</TableHead>
              <TableHead>Your Pick</TableHead>
              <TableHead className="text-right">Wager</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-center">Outcome</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bets.map((bet) => (
              <TableRow key={bet.id}>
                <TableCell>
                  <div className="font-medium">{bet.awayTeam} @ {bet.homeTeam}</div>
                  <div className="text-sm text-muted-foreground">
                    {format(new Date(bet.eventDate), "MMM d, yyyy")}
                  </div>
                </TableCell>
                <TableCell><OpponentDisplay bet={bet} currentUserId={currentUserId} /></TableCell>
                <TableCell><BetValueDisplay bet={bet} /></TableCell>
                <TableCell className="text-right font-bold">${bet.totalWager.toFixed(2)}</TableCell>
                <TableCell className="text-center">
                   <Badge variant={bet.status === 'pending' ? 'secondary' : 'default'} className={cn({
                       'bg-green-100 text-green-800': bet.status === 'active',
                       'bg-gray-100 text-gray-800': bet.status === 'settled',
                       'bg-yellow-100 text-yellow-800': bet.status === 'pending',
                       'bg-red-100 text-red-800': bet.status === 'canceled',
                   })}>
                        {bet.status.replace(/_/g, ' ')}
                    </Badge>
                </TableCell>
                <TableCell className="text-center">
                    <OutcomeBadge bet={bet} currentUserId={currentUserId} />
                </TableCell>
                 <TableCell className="text-right space-x-1">
                    {bet.status === 'pending' && bet.challengerId === currentUserId && bet.accepters.length === 0 && (
                        <Button variant="destructive" size="sm" onClick={() => handleCancelBet(bet.id)} disabled={isCanceling[bet.id]}>
                            <XCircle className="mr-2 h-4 w-4" /> Cancel
                        </Button>
                    )}
                    {bet.status === 'pending' && bet.challengerId === currentUserId && bet.isPublic === false && (
                        <Button variant="ghost" size="sm" onClick={() => handleShareLink(bet)}>
                            <Twitter className="mr-2 h-4 w-4" /> Share
                        </Button>
                    )}
                    <Link href={`/bet/${bet.id}`} passHref>
                        <Button variant="outline" size="sm">
                            View <ArrowUpRight className="ml-2 h-4 w-4" />
                        </Button>
                    </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
