
"use client"
import { collection, getDocs, query, where, orderBy, Timestamp } from "firebase/firestore";
import { firestore as getFirestore } from "@/lib/firebase-admin";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import type { Game } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { GameList } from "@/components/game-list";


async function getGames(sportKey: string): Promise<Game[]> {
  try {
    const firestore = getFirestore();
    if (!firestore) {
        console.log("Firestore not initialized");
        return [];
    }
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
       <GameList initialGames={games} />
    </main>
  );
}
