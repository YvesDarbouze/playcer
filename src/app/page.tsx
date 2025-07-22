
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { firestore } from "@/lib/firebase-admin";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";

type Sport = {
  key: string;
  group: string;
  title: string;
  description: string;
  active: boolean;
};

async function getSports() {
  // In a real app, this might come from a 'sports' collection.
  // For now, we return a hardcoded list that matches what our functions support.
  return [
    { key: 'americanfootball_nfl', group: 'US Sports', title: 'NFL', description: 'National Football League', active: true },
    { key: 'basketball_nba', group: 'US Sports', title: 'NBA', description: 'National Basketball Association', active: true },
    { key: 'baseball_mlb', group: 'US Sports', title: 'MLB', description: 'Major League Baseball', active: true },
  ];
}

export default async function SportsHomePage() {
  const sports = await getSports();

  const sportsByGroup = sports.reduce((acc, sport) => {
    const group = sport.group;
    if (!acc[group]) {
      acc[group] = [];
    }
    acc[group].push(sport);
    return acc;
  }, {} as Record<string, Sport[]>);

  return (
    <main className="container mx-auto p-4 md:p-8">
      <header className="mb-8">
        <h1 className="text-4xl font-headline font-black">Browse Sports</h1>
        <p className="text-muted-foreground">Select a sport to see upcoming games and odds.</p>
      </header>
      <div className="space-y-8">
        {Object.entries(sportsByGroup).map(([group, sportsInGroup]) => (
          <section key={group}>
            <h2 className="text-2xl font-headline font-black mb-4">{group}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sportsInGroup.map((sport) => (
                <Link href={`/sport/${sport.key}`} key={sport.key} passHref>
                  <Card className="hover:border-primary hover:shadow-lg transition-all h-full flex flex-col">
                    <CardHeader>
                      <CardTitle>{sport.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-grow flex justify-between items-end">
                      <p className="text-muted-foreground">{sport.description}</p>
                      <ArrowRight className="text-primary" />
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
