
import { collection, getDocs, query, where, orderBy, Timestamp } from "firebase/firestore";
import { firestore } from "@/lib/firebase-admin";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import type { Game } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

async function getGames(sportKey: string): Promise<Game[]> {
  try {
    const gamesRef = collection(firestore, "games");
    const q = query(
      gamesRef,
      where("sport_key", "==", sportKey),
      orderBy("commence_time", "asc")
    );
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      // For demo, return mock data if nothing in DB
      return [
        { id: 'nfl_1', commence_time: new Date().toISOString(), home_team: 'Rams', away_team: '49ers', sport_key: sportKey, sport_title: "NFL", is_complete: false } as Game,
        { id: 'nfl_2', commence_time: new Date(Date.now() + 86400000).toISOString(), home_team: 'Chiefs', away_team: 'Eagles', sport_key: sportKey, sport_title: "NFL", is_complete: false } as Game,
      ];
    }
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        commence_time: (data.commence_time as Timestamp).toDate().toISOString(),
      } as unknown as Game;
    });
  } catch (error) {
    console.error(`Error fetching games for ${sportKey}:`, error);
    return [];
  }
}

export default async function SportPage({ params }: { params: { sport_key: string } }) {
  const { sport_key } = params;
  const games = await getGames(sport_key);

  if (games.length === 0) {
    notFound();
  }

  const sportTitle = games[0]?.sport_title || sport_key.replace(/_/g, " ").toUpperCase();

  const gamesByDate = games.reduce((acc, game) => {
    const date = format(new Date(game.commence_time), "EEEE, MMMM d, yyyy");
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(game);
    return acc;
  }, {} as Record<string, Game[]>);

  return (
    <main className="container mx-auto p-4 md:p-8">
      <header className="mb-8">
        <Link href="/" passHref>
          <Button variant="outline" className="mb-4">
            <ArrowLeft className="mr-2" />
            All Sports
          </Button>
        </Link>
        <h1 className="text-4xl font-headline font-black">{sportTitle} Schedule</h1>
        <p className="text-muted-foreground">Upcoming games for the {sportTitle}.</p>
      </header>
      <div className="space-y-8">
        {Object.entries(gamesByDate).map(([date, gamesOnDate]) => (
          <section key={date}>
            <h2 className="text-xl font-bold mb-4">{date}</h2>
            <div className="space-y-4">
              {gamesOnDate.map((game) => (
                <Link href={`/game/${game.id}`} key={game.id} passHref>
                    <Card className={cn(
                        "hover:border-primary transition-colors",
                        game.is_complete && "bg-muted/50 hover:border-muted"
                    )}>
                        <CardContent className="p-4 flex justify-between items-center">
                            <div>
                                <p className={cn(
                                    "font-bold text-lg",
                                    game.is_complete && "text-muted-foreground"
                                )}>
                                  {game.away_team} {game.is_complete && <span className="font-extrabold">{game.away_score}</span>}
                                  {' @ '} 
                                  {game.home_team} {game.is_complete && <span className="font-extrabold">{game.home_score}</span>}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    {game.is_complete ? "Final" : format(new Date(game.commence_time), "h:mm a")}
                                </p>
                            </div>
                            <Button variant={game.is_complete ? "ghost" : "secondary"} disabled={game.is_complete}>
                              {game.is_complete ? "View Results" : "View Odds"}
                            </Button>
                        </CardContent>
                    </Card>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
