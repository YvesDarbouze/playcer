
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
import { ArrowUpRight, Copy, CheckCircle, XCircle, MinusCircle, User as UserIcon } from "lucide-react";
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
      ? { id: bet.challengerId, username: bet.challengerUsername, photoURL: bet.challengerPhotoURL }
      : { id: bet.creatorId, username: bet.creatorUsername, photoURL: bet.creatorPhotoURL };

    if (!opponent.username || !opponent.id) {
        return <span className="text-muted-foreground">Awaiting Challenger</span>
    }
    
    return (
        <Link href={`/profile/${opponent.id}`} className="flex items-center gap-2 hover:underline">
            <Avatar className="size-6">
                <AvatarImage src={opponent.photoURL || undefined} alt={opponent.username} />
                <AvatarFallback>{opponent.username.charAt(0)}</AvatarFallback>
            </Avatar>
            <span className="font-medium">@{opponent.username}</span>
        </Link>
    )
}

const OutcomeBadge = ({ bet, currentUserId }: { bet: Bet, currentUserId: string }) => {
    if (bet.status !== 'settled' && bet.status !== 'void') return null;

    if(bet.status === 'void'){
        return <Badge variant="secondary">Push</Badge>;
    }

    if (bet.winnerId === currentUserId) {
        return <Badge variant="default" className="bg-green-500 hover:bg-green-600">Win</Badge>
    }
    if (bet.winnerId) {
        return <Badge variant="destructive">Loss</Badge>
    }

    return null;
}

export function UserBetsTable({ bets, currentUserId }: UserBetsTableProps) {
  const { toast } = useToast();

  const handleCopyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast({ title: "Challenge link copied!" });
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
              <TableHead className="text-right">Stake</TableHead>
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
                <TableCell>{bet.teamSelection} {bet.line ? `(${bet.line > 0 ? '+' : ''}${bet.line})` : ''}</TableCell>
                <TableCell className="text-right font-headline font-black">${bet.stake.toFixed(2)}</TableCell>
                <TableCell className="text-center">
                   <Badge variant={bet.status === 'open' ? 'secondary' : 'default'} className={cn({
                       'bg-green-100 text-green-800': bet.status === 'matched',
                       'bg-gray-100 text-gray-800': bet.status === 'settled',
                       'bg-yellow-100 text-yellow-800': bet.status === 'open'
                   })}>
                        {bet.status.charAt(0).toUpperCase() + bet.status.slice(1)}
                    </Badge>
                </TableCell>
                <TableCell className="text-center">
                    <OutcomeBadge bet={bet} currentUserId={currentUserId} />
                </TableCell>
                 <TableCell className="text-right space-x-1">
                    {bet.status === 'open' && (
                        <Button variant="ghost" size="sm" onClick={() => handleCopyLink(`${window.location.origin}/bet/${bet.id}`)}>
                            <Copy className="mr-2 h-4 w-4" /> Copy
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
