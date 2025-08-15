
"use client";

import type { Bet } from "@/types";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowUpRight, User, Swords } from "lucide-react";
import Link from "next/link";

const BetValueDisplay = ({ bet }: { bet: Bet }) => {
    const { betValue, betType } = bet;
    if (betType === 'moneyline') {
        return <>{betValue.team}</>;
    }
    if (betType === 'spread') {
        return <>{betValue.team} {betValue.points! > 0 ? `+${betValue.points}` : betValue.points}</>;
    }
    if (betType === 'totals') {
        return <>Total {betValue.over_under} {betValue.total}</>;
    }
    return null;
}


export function MarketplaceBetCard({ bet }: { bet: Bet }) {
    
    const eventDate = new Date(bet.gameDetails.commence_time);
    
    return (
        <Card className="flex flex-col h-full hover:shadow-lg transition-shadow">
            <CardHeader className="pb-4">
                <CardDescription>
                    {format(eventDate, "EEE, MMM d, h:mm a")}
                </CardDescription>
                <CardTitle className="font-bold text-lg">{bet.gameDetails.away_team} @ {bet.gameDetails.home_team}</CardTitle>
            </CardHeader>
            <CardContent className="flex-grow space-y-4">
                 <div className="flex justify-between items-center text-center bg-muted p-3 rounded-md">
                     <div className="flex flex-col items-center">
                        <Avatar className="size-10">
                            <AvatarImage src={bet.creatorPhotoURL} alt={bet.creatorUsername} />
                            <AvatarFallback><User className="size-5" /></AvatarFallback>
                        </Avatar>
                        <span className="text-xs font-bold mt-1">@{bet.creatorUsername}</span>
                    </div>
                     <div className="flex flex-col items-center">
                        <Swords className="text-primary size-6" />
                        <span className="font-bold text-xl">${bet.wagerAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex flex-col items-center">
                         <Avatar className="size-10">
                            <AvatarFallback>?</AvatarFallback>
                        </Avatar>
                        <span className="text-xs text-muted-foreground mt-1">Anyone</span>
                    </div>
                </div>
                 <div>
                    <p className="text-sm font-semibold text-muted-foreground">Pick</p>
                    <p className="font-bold text-primary text-base"><BetValueDisplay bet={bet} /></p>
                </div>
            </CardContent>
            <CardFooter className="p-0">
                 <Link href={`/bet/${bet.id}`} className="w-full" passHref>
                    <Button className="w-full rounded-t-none h-12 text-base font-bold">
                        View & Accept Challenge
                        <ArrowUpRight className="ml-2"/>
                    </Button>
                 </Link>
            </CardFooter>
        </Card>
    )
}
