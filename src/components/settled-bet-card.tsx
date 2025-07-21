
"use client";

import type { Bet } from "@/types";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, Swords, User } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Badge } from "./ui/badge";

interface SettledBetCardProps {
    bet: Bet;
    profileUserId: string;
}

const OpponentDetails = ({ bet, profileUserId }: { bet: Bet, profileUserId: string}) => {
    const isCreator = bet.creatorId === profileUserId;
    
    const opponent = isCreator
        ? { id: bet.challengerId, username: bet.challengerUsername, photoURL: bet.challengerPhotoURL }
        : { id: bet.creatorId, username: bet.creatorUsername, photoURL: bet.creatorPhotoURL };

    if (!opponent.id) return null;

    return (
        <Link href={`/profile/${opponent.id}`} className="flex items-center gap-2 hover:underline">
            <Avatar className="size-6">
                <AvatarImage src={opponent.photoURL || undefined} alt={opponent.username || "user"} />
                <AvatarFallback><User className="size-4" /></AvatarFallback>
            </Avatar>
            <span>@{opponent.username}</span>
        </Link>
    )
}

export function SettledBetCard({ bet, profileUserId }: SettledBetCardProps) {
    const settledDate = new Date(bet.settledAt!);
    const isWinner = bet.winnerId === profileUserId;
    
    const outcomeText = isWinner ? "Win" : "Loss";
    const outcomeColor = isWinner ? "bg-green-500" : "bg-destructive";

    return (
        <Card>
            <CardContent className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex-1 space-y-1 text-center md:text-left">
                     <p className="text-sm text-muted-foreground">{bet.awayTeam} @ {bet.homeTeam}</p>
                     <p className="font-bold">{bet.outcomeDescription}</p>
                     <p className="text-xs text-muted-foreground">Settled on {format(settledDate, "MMM d, yyyy")}</p>
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <p>vs.</p>
                    <OpponentDetails bet={bet} profileUserId={profileUserId} />
                </div>
                
                <div className="flex items-center gap-6">
                    <div className="text-center">
                        <p className="text-xs text-muted-foreground">Wager</p>
                        <p className="font-bold text-lg">${bet.stake.toFixed(2)}</p>
                    </div>
                     <Badge className={cn("text-lg font-bold w-20 justify-center", outcomeColor)}>
                        <Trophy className="mr-2" />
                        {outcomeText}
                    </Badge>
                </div>
            </CardContent>
        </Card>
    );
}
