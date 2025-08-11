
"use client";

import type { User, Bet } from "@/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SettledBetCard } from "./settled-bet-card";

interface PublicProfileProps {
    user: User;
    settledBets: Bet[];
}

export function PublicProfile({ user, settledBets }: PublicProfileProps) {
    return (
        <div className="space-y-8">
            <Card className="shadow-lg">
                <CardHeader className="p-6 flex flex-col md:flex-row items-center gap-6">
                    <Avatar className="h-24 w-24 border-4 border-primary">
                        <AvatarImage src={user.photoURL} alt={user.displayName} />
                        <AvatarFallback>{user.username.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-center md:text-left">
                        <h1 className="text-3xl font-headline font-black">{user.displayName}</h1>
                        <p className="text-muted-foreground text-lg">@{user.username}</p>
                    </div>
                     <div className="flex flex-wrap justify-center gap-4">
                        <div className="text-center">
                            <p className="text-3xl font-bold text-primary">{user.wins}</p>
                            <p className="text-sm text-muted-foreground">Total Wins</p>
                        </div>
                        <div className="text-center">
                            <p className="text-3xl font-bold text-destructive">{user.losses}</p>
                            <p className="text-sm text-muted-foreground">Total Losses</p>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <section>
                <h2 className="text-2xl font-bold mb-4">Recent Bet History</h2>
                {settledBets.length > 0 ? (
                    <div className="grid grid-cols-1 gap-4">
                        {settledBets.map(bet => (
                           <SettledBetCard key={bet.id} bet={bet} profileUserId={user.id} />
                        ))}
                    </div>
                ) : (
                    <Card>
                        <CardContent className="p-6 text-center text-muted-foreground">
                            This user has no public betting history yet.
                        </CardContent>
                    </Card>
                )}
            </section>
        </div>
    );
}

    