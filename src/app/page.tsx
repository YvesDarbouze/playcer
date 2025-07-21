
import { GameList } from "@/components/game-list";
import { Game } from "@/types";

// In a real app, this would fetch from a live sports data API.
// We are using a mock function to simulate this.
const getUpcomingGames = async (): Promise<Game[]> => {
  return [
    {
      id: "nba_1",
      sport_key: "basketball_nba",
      sport_title: "NBA",
      commence_time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      home_team: "Los Angeles Lakers",
      away_team: "Los Angeles Clippers",
    },
    {
      id: "nba_2",
      sport_key: "basketball_nba",
      sport_title: "NBA",
      commence_time: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
      home_team: "Golden State Warriors",
      away_team: "Boston Celtics",
    },
    {
      id: "nfl_1",
      sport_key: "americanfootball_nfl",
      sport_title: "NFL",
      commence_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      home_team: "Kansas City Chiefs",
      away_team: "Philadelphia Eagles",
    },
    {
      id: "nfl_2",
      sport_key: "americanfootball_nfl",
      sport_title: "NFL",
      commence_time: new Date(Date.now() + 26 * 60 * 60 * 1000).toISOString(),
      home_team: "San Francisco 49ers",
      away_team: "Los Angeles Rams",
    },
     {
      id: "mlb_1",
      sport_key: "baseball_mlb",
      sport_title: "MLB",
      commence_time: new Date(Date.now() + 28 * 60 * 60 * 1000).toISOString(),
      home_team: "New York Yankees",
      away_team: "Boston Red Sox",
    },
     {
      id: "mlb_2",
      sport_key: "baseball_mlb",
      sport_title: "MLB",
      commence_time: new Date(Date.now() + 30 * 60 * 60 * 1000).toISOString(),
      home_team: "Los Angeles Dodgers",
      away_team: "San Diego Padres",
    },
  ];
};

export default async function Home() {
  const games = await getUpcomingGames();

  return (
    <main className="bg-background min-h-screen">
       <div className="container mx-auto p-4 md:p-8">
            <GameList initialGames={games} />
       </div>
    </main>
  );
}
