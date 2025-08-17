


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
import { ArrowUpRight, Twitter } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

interface UserBetsTableProps {
  bets: Bet[];
  currentUserId: string;
}

const OpponentDisplay = ({ bet, currentUserId }: { bet: Bet, currentUserId: string }) => {
    const isCreator = bet.creatorId === currentUserId;
    
    const opponent = isCreator
      ? { id: bet.takerId, username: bet.takerUsername, photoURL: bet.takerPhotoURL }
      : { id: bet.creatorId, username: bet.creatorUsername, photoURL: bet.creatorPhotoURL };

    if (!opponent.id) {
        return <span className="text-muted-foreground">vs. Public</span>
    }
    
    return (
        <Link href={`/profile/${opponent.id}`} className="flex items-center gap-2 hover:underline">
            <Avatar className="size-6">
                <AvatarImage src={opponent.photoURL || undefined} alt={opponent.username} />
                <AvatarFallback>{opponent.username ? opponent.username.charAt(0) : '?'}</AvatarFallback>
            </Avatar>
            <span className="font-medium">@{opponent.username}</span>
        </Link>
    )
}

const OutcomeBadge = ({ bet, currentUserId }: { bet: Bet, currentUserId: string }) => {
    if (bet.outcome === 'draw') return <Badge variant="secondary">Push</Badge>;
    if (bet.status !== 'resolved') return null;

    if (!bet.winnerId) {
        return <Badge variant="secondary">?</Badge>;
    }

    if (bet.winnerId === currentUserId) {
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
      const team = chosenOption;
      return <>{`${team} ${line! > 0 ? `+${line}` : line}`}</>;
    }
    if (betType === 'totals') {
      return <>{`Total ${chosenOption} ${line}`}</>;
    }
    return <>{chosenOption}</>;
}

export function UserBetsTable({ bets, currentUserId }: UserBetsTableProps) {
  const { toast } = useToast();

  const handleCopyLink = (bet: Bet) => {
    const tweetUrl = bet.twitterShareUrl || `https://twitter.com/intent/tweet?text=${encodeURIComponent(`I just posted a public challenge on Playcer for ${bet.awayTeam} @ ${bet.homeTeam}. Who wants to accept?`)}`;
    window.open(tweetUrl, '_blank');
    toast({ title: "Opening Twitter to send challenge!" });
  };
  
  if (bets.length === 0) {
    return (
        <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
                No bets found in this category.
            </CardContent>
        </Card>
    )
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
                <TableCell className="text-right font-bold">${bet.stakeAmount.toFixed(2)}</TableCell>
                <TableCell className="text-center">
                   <Badge variant={bet.status === 'pending' ? 'secondary' : 'default'} className={cn({
                       'bg-green-100 text-green-800': bet.status === 'accepted',
                       'bg-gray-100 text-gray-800': bet.status === 'resolved',
                       'bg-yellow-100 text-yellow-800': bet.status === 'pending'
                   })}>
                        {bet.status.replace(/_/g, ' ').toUpperCase()}
                    </Badge>
                </TableCell>
                <TableCell className="text-center">
                    <OutcomeBadge bet={bet} currentUserId={currentUserId} />
                </TableCell>
                 <TableCell className="text-right space-x-1">
                    {bet.status === 'pending' && bet.creatorId === currentUserId && (
                        <Button variant="ghost" size="sm" onClick={() => handleCopyLink(bet)}>
                            <Twitter className="mr-2 h-4 w-4" /> Tweet
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
