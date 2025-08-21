
"use client"
import { collection, getDocs, query, where, orderBy, Timestamp } from "firebase/firestore";
import { firestore } from "@/lib/firebase";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import type { Game } from "@/types";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { GameList } from "@/components/game-list";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";


async function getGamesBySport(sportKey: string): Promise<Game[]> {
  try {
    const gamesRef = collection(firestore, "games");
    const q = query(
      gamesRef,
      where("sport_key", "==", sportKey),
      orderBy("commence_time", "asc")
    );
    const querySnapshot = await getDocs(q);
    
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

export default function SportPage() {
  const params = useParams();
  const sport_key = params.sport_key as string;
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sport_key) return;
    const fetchGames = async () => {
        setLoading(true);
        const fetchedGames = await getGamesBySport(sport_key);
        setGames(fetchedGames);
        setLoading(false);
    }
    fetchGames();
  }, [sport_key])

  if (loading) {
      return (
          <main className="container mx-auto p-4 md:p-8">
               <Skeleton className="h-10 w-48 mb-4" />
               <Skeleton className="h-12 w-96 mb-2" />
               <Skeleton className="h-6 w-72 mb-8" />
               <div className="space-y-4">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
               </div>
          </main>
      )
  }

  if (!loading && games.length === 0) {
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
