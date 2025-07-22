
"use client";

import type { Bet } from "@/types";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowUpRight, User } from "lucide-react";
import Link from "next/link";


export function MarketplaceBetCard({ bet }: { bet: Bet }) {
    
    // Convert string dates back to Date objects
    const eventDate = new Date(bet.eventDate);
    
    return (
        <Card className="flex flex-col h-full hover:shadow-lg transition-shadow">
            <CardHeader className="pb-4">
                <CardDescription>
                    {format(eventDate, "EEE, MMM d, yyyy 'at' h:mm a")}
                </CardDescription>
                <CardTitle className="font-bold">{bet.awayTeam} @ {bet.homeTeam}</CardTitle>
            </CardHeader>
            <CardContent className="flex-grow space-y-3">
                <div>
                    <p className="text-sm font-semibold text-muted-foreground">Bet On</p>
                    <p className="font-bold">{bet.marketDescription}</p>
                </div>
                <div>
                    <p className="text-sm font-semibold text-muted-foreground">Pick</p>
                    <p className="font-bold">{bet.outcomeDescription}</p>
                </div>
                <div className="flex justify-between items-baseline pt-2">
                    <div>
                        <p className="text-sm font-semibold text-muted-foreground">Wager</p>
                        <p className="text-2xl font-bold text-primary">${bet.stake.toFixed(2)}</p>
                    </div>
                     <div>
                        <p className="text-sm font-semibold text-muted-foreground text-right">Odds</p>
                        <p className="text-2xl font-bold">{bet.odds > 0 ? `+${bet.odds}` : bet.odds}</p>
                    </div>
                </div>
            </CardContent>
            <Separator />
            <CardFooter className="p-4 bg-muted/30 flex justify-between items-center">
                 <div className="flex items-center gap-2 text-sm">
                    <Avatar className="size-8">
                        <AvatarImage src={bet.creatorPhotoURL} alt={bet.creatorUsername} />
                        <AvatarFallback><User className="size-4" /></AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-muted-foreground">@{bet.creatorUsername}</span>
                 </div>
                 <Link href={`/bet/${bet.id}`} passHref>
                    <Button>
                        Accept Bet
                        <ArrowUpRight />
                    </Button>
                 </Link>
            </CardFooter>
        </Card>
    )
}
