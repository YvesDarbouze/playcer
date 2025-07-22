
"use client";

import Link from "next/link";
import { Logo } from "./icons";
import { LoginButton } from "./login-button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "./ui/button";
import { Menu } from "lucide-react";

export function SiteHeader() {
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
