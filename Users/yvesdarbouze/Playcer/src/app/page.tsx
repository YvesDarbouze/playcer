
import { collection, getDocs, query, orderBy, Timestamp } from "firebase/firestore";
import { firestore as getFirestore } from "@/lib/firebase-admin";
import { GameList } from "@/components/game-list";
import type { Game } from "@/types";

export const dynamic = 'force-dynamic';

async function getGames(): Promise<Game[]> {
  try {
    const firestore = getFirestore();
    if (!firestore) {
      console.log("Firestore not initialized, returning mock data.");
      // Return mock data if Firestore isn't available on the server
      return [
        { id: 'nfl_1', commence_time: new Date(Date.now() + 3600000).toISOString(), home_team: 'Los Angeles Rams', away_team: 'San Francisco 49ers', sport_key: 'americanfootball_nfl', sport_title: "NFL" } as Game,
        { id: 'nfl_2', commence_time: new Date(Date.now() + 86400000).toISOString(), home_team: 'Kansas City Chiefs', away_team: 'Philadelphia Eagles', sport_key: 'americanfootball_nfl', sport_title: "NFL" } as Game,
        { id: 'nba_1', commence_time: new Date(Date.now() + 172800000).toISOString(), home_team: 'Los Angeles Lakers', away_team: 'Los Angeles Clippers', sport_key: 'basketball_nba', sport_title: "NBA" } as Game,
        { id: 'mlb_1', commence_time: new Date(Date.now() + 259200000).toISOString(), home_team: 'New York Yankees', away_team: 'Boston Red Sox', sport_key: 'baseball_mlb', sport_title: "MLB" } as Game,
      ];
    }

    const gamesRef = collection(firestore, "games");
    const q = query(
      gamesRef,
      orderBy("commence_time", "asc")
    );
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        console.log("No games in Firestore, returning mock data.");
        return [
           { id: 'nfl_1', commence_time: new Date(Date.now() + 3600000).toISOString(), home_team: 'Los Angeles Rams', away_team: 'San Francisco 49ers', sport_key: 'americanfootball_nfl', sport_title: "NFL" } as Game,
           { id: 'nfl_2', commence_time: new Date(Date.now() + 86400000).toISOString(), home_team: 'Kansas City Chiefs', away_team: 'Philadelphia Eagles', sport_key: 'americanfootball_nfl', sport_title: "NFL" } as Game,
           { id: 'nba_1', commence_time: new Date(Date.now() + 172800000).toISOString(), home_team: 'Los Angeles Lakers', away_team: 'Los Angeles Clippers', sport_key: 'basketball_nba', sport_title: "NBA" } as Game,
           { id: 'mlb_1', commence_time: new Date(Date.now() + 259200000).toISOString(), home_team: 'New York Yankees', away_team: 'Boston Red Sox', sport_key: 'baseball_mlb', sport_title: "MLB" } as Game,
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
    console.error("Error fetching games:", error);
    // Return mock data on any error
    return [
       { id: 'nfl_1', commence_time: new Date(Date.now() + 3600000).toISOString(), home_team: 'Los Angeles Rams', away_team: 'San Francisco 49ers', sport_key: 'americanfootball_nfl', sport_title: "NFL" } as Game,
       { id: 'nfl_2', commence_time: new Date(Date.now() + 86400000).toISOString(), home_team: 'Kansas City Chiefs', away_team: 'Philadelphia Eagles', sport_key: 'americanfootball_nfl', sport_title: "NFL" } as Game,
       { id: 'nba_1', commence_time: new Date(Date.now() + 172800000).toISOString(), home_team: 'Los Angeles Lakers', away_team: 'Los Angeles Clippers', sport_key: 'basketball_nba', sport_title: "NBA" } as Game,
       { id: 'mlb_1', commence_time: new Date(Date.now() + 259200000).toISOString(), home_team: 'New York Yankees', away_team: 'Boston Red Sox', sport_key: 'baseball_mlb', sport_title: "MLB" } as Game,
    ];
  }
}


export default async function HomePage() {
  const games = await getGames();
  return (
    <main>
      <GameList initialGames={games} />
    </main>
  );
}
