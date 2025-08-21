
"use client";

import Link from "next/link";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Logo } from "./icons";
import { LoginButton } from "./login-button";
import { Button } from "./ui/button";
import { Search, Bot } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import algoliasearch from "algoliasearch/lite";
import { InstantSearch } from "react-instantsearch";
import { SearchBox } from "./search/search-box";
import { NotificationBell } from "./notification-bell";


const appId = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID;
const apiKey = process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_ONLY_API_KEY;
const searchClient = appId && apiKey ? algoliasearch(appId, apiKey) : null;


export function SiteHeader() {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center">
        <div className="mr-4 flex items-center">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-6 text-sm md:flex">
            <Link
              href="/marketplace"
              className="transition-colors hover:text-foreground/80 text-foreground/80"
            >
              Marketplace
            </Link>
            <Link
              href="/dashboard"
              className="transition-colors hover:text-foreground/80 text-foreground/60"
            >
              Dashboard
            </Link>
             <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="transition-colors hover:text-foreground/80 text-foreground/60 px-0">
                        Dev Tools
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => router.push('/dev/odds-checker')}>
                        <Bot className="mr-2 h-4 w-4" />
                        <span>Game Ingestion Checker</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push('/dev/arbitrage-finder')}>
                         <Bot className="mr-2 h-4 w-4" />
                        <span>Arbitrage Finder</span>
                    </DropdownMenuItem>
                     <DropdownMenuItem onClick={() => router.push('/dev/consensus-checker')}>
                         <Bot className="mr-2 h-4 w-4" />
                        <span>Consensus Checker</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            <Link
              href="/about"
              className="transition-colors hover:text-foreground/80 text-foreground/60"
            >
              About
            </Link>
          </nav>
        </div>
        
        <div className="flex flex-1 items-center justify-end space-x-2">
            {searchClient && (
                 <div className="relative w-full max-w-sm hidden md:block">
                    <InstantSearch
                    searchClient={searchClient}
                    indexName="bets"
                    >
                    <SearchBox />
                    </InstantSearch>
                </div>
            )}
            <NotificationBell />
            <LoginButton />
        </div>
      </div>
    </header>
  );
}
