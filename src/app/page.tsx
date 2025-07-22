
import { collection, getDocs, query, orderBy, where } from "firebase/firestore";
import { firestore as getFirestore } from "@/lib/firebase-admin";
import type { Game } from "@/types";
import { GameList } from "@/components/game-list";


async function getUpcomingGames(): Promise<Game[]> {
  try {
    const firestore = getFirestore();
    if (!firestore) {
        console.log("Firestore not initialized");
        return [];
    }
    const gamesRef = collection(firestore, "games");
    const q = query(
      gamesRef,
      where('is_complete', '!=', true),
      orderBy("is_complete"),
      orderBy("commence_time", "asc")
    );
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      // For demo, return mock data if nothing in DB
      return [
        { id: 'nfl_1', commence_time: new Date().toISOString(), home_team: 'Rams', away_team: '49ers', sport_key: 'americanfootball_nfl', sport_title: "NFL", is_complete: false } as Game,
        { id: 'nfl_2', commence_time: new Date(Date.now() + 86400000).toISOString(), home_team: 'Chiefs', away_team: 'Eagles', sport_key: 'americanfootball_nfl', sport_title: "NFL", is_complete: false } as Game,
        { id: 'nba_1', commence_time: new Date().toISOString(), home_team: 'Lakers', away_team: 'Clippers', sport_key: 'basketball_nba', sport_title: "NBA" } as Game,
        { id: 'nba_2', commence_time: new Date(Date.now() + 2 * 86400000).toISOString(), home_team: 'Celtics', away_team: 'Warriors', sport_key: 'basketball_nba', sport_title: "NBA" } as Game,
      ];
    }
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        commence_time: (data.commence_time as any).toDate().toISOString(),
      } as unknown as Game;
    });
  } catch (error) {
    console.error(`Error fetching upcoming games:`, error);
    return [];
  }
}

export default async function SportsHomePage() {
  const games = await getUpcomingGames();

  return (
    <main className="bg-background-offwhite">
      <GameList initialGames={games} />
    </main>
  );
}
