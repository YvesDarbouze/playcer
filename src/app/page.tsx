
import { GameList } from "@/components/game-list";
import { getGames } from "@/lib/games";


export default async function HomePage() {
  const games = await getGames();
  return (
    <main>
      <GameList initialGames={games} />
    </main>
  );
}
