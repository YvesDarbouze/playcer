import { GameList } from "@/components/game-list";
import type { Game } from '@/types';

async function getGames(): Promise<Game[]> {
    const apiKey = process.env.ODDS_API_KEY;
    if (!apiKey || apiKey === 'YOUR_ODDS_API_KEY') {
        console.warn("ODDS_API_KEY is not set. Using mock data.");
        // Returning empty array for mock data, as per original logic.
        // A more robust mock could be added here if needed.
        return [];
    }

    const sports = ['americanfootball_nfl', 'basketball_nba', 'baseball_mlb'];
    const allGames: Game[] = [];

    try {
        for (const sport of sports) {
            const url = `https://api.the-odds-api.com/v4/sports/${sport}/odds/?regions=us&markets=h2h,spreads&oddsFormat=american&apiKey=${apiKey}`;
            const res = await fetch(url, { next: { revalidate: 3600 } }); // Revalidate every hour

            if (!res.ok) {
                console.error(`Failed to fetch data for ${sport}: ${res.statusText}`);
                continue; 
            }
            
            const games: Game[] = await res.json();
            allGames.push(...games);
        }
        return allGames;
    } catch (error) {
        console.error("Error fetching game data:", error);
        return []; // Return empty array on error
    }
}


export default async function Home() {
    const games = await getGames();

    return (
        <main className="bg-background text-foreground">
            <div className="container mx-auto px-4 py-8">
                <GameList initialGames={games} />
            </div>
        </main>
    );
}
