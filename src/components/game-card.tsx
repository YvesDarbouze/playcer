import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from './ui/button';
import { Swords } from 'lucide-react';

interface GameCardProps {
    game: {
        id: string;
        sport_title: string;
        home_team: string;
        away_team: string;
        commence_time: string;
    };
}

export function GameCard({ game }: GameCardProps) {
    const gameTime = new Date(game.commence_time);

    return (
        <Card className="hover:shadow-lg transition-shadow duration-200">
            <CardHeader>
                <CardDescription>{game.sport_title}</CardDescription>
                <CardTitle className="text-xl font-bold">{game.away_team} @ {game.home_team}</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-between items-center">
                <div>
                    <p className="text-sm text-muted-foreground">
                        {format(gameTime, "EEE, MMM d, yyyy")}
                    </p>
                    <p className="text-sm font-semibold">
                        {format(gameTime, "h:mm a")}
                    </p>
                </div>
                <Button>
                    <Swords className="mr-2 h-4 w-4" />
                    Create Bet
                </Button>
            </CardContent>
        </Card>
    );
}
