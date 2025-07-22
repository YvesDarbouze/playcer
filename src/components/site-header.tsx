
"use client";

import Link from "next/link";
import * as React from "react";
import { Logo } from "./icons";
import { LoginButton } from "./login-button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "./ui/button";
import { Menu, Rss } from "lucide-react";
import type { Game } from "@/types";
import { Separator } from "./ui/separator";

// In a real app, this would be a proper API call.
const getSports = async (): Promise<{ key: string, title: string }[]> => {
    await new Promise(res => setTimeout(res, 500)); // Simulate network delay
    return [
        { key: 'americanfootball_nfl', title: 'NFL' },
        { key: 'basketball_nba', title: 'NBA' },
        { key: 'baseball_mlb', title: 'MLB' },
    ];
};


export function SiteHeader() {
  const [sports, setSports] = React.useState<{ key: string, title: string }[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const loadSports = async () => {
      setLoading(true);
      const fetchedSports = await getSports();
      setSports(fetchedSports);
      setLoading(false);
    }
    loadSports();
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center">
        <div className="mr-4 hidden md:flex">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <Logo className="h-6 w-6" />
            <span className="hidden font-bold sm:inline-block">
              Playcer
            </span>
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link
              href="/marketplace"
              className="transition-colors hover:text-foreground/80 text-foreground/60"
            >
              Marketplace
            </Link>
          </nav>
        </div>
        
        {/* Mobile Nav */}
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 w-9 px-0 text-base md:hidden"
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle Menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left">
            <Link href="/" className="flex items-center">
                <Logo className="h-6 w-6" />
                <span className="font-bold ml-2">Playcer</span>
            </Link>
            <div className="flex flex-col gap-4 mt-8">
                 <Link href="/marketplace" className="text-lg font-medium">
                    Marketplace
                </Link>
                 <Link href="/dashboard" className="text-lg font-medium">
                    Dashboard
                </Link>

                <Separator className="my-2" />

                <h4 className="font-semibold text-muted-foreground">Sports</h4>
                {loading ? (
                  <p>Loading sports...</p>
                ) : (
                  sports.map(sport => (
                    <Link key={sport.key} href={`/sport/${sport.key}`} className="text-lg font-medium">
                      {sport.title}
                    </Link>
                  ))
                )}
                
                <Separator className="my-2" />
                
                 <Link href="/about" className="text-lg font-medium">
                    About Us
                </Link>

            </div>
          </SheetContent>
        </Sheet>
        
        <div className="flex flex-1 items-center justify-end space-x-2">
          <LoginButton />
        </div>
      </div>
    </header>
  );
}
