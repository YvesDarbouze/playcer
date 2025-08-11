
import { Button } from "@/components/ui/button";
import { Search } from 'lucide-react';
import Image from 'next/image';
import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <header className="relative bg-secondary text-white py-20 md:py-32 text-center overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src="https://placehold.co/1920x1080.png"
            alt="Background image of a sports stadium"
            fill
            className="object-cover opacity-20"
            data-ai-hint="stadium lights"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-secondary via-secondary/80 to-secondary/50"></div>
        </div>
        
        <div className="container mx-auto relative z-10">
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-headline font-black uppercase tracking-tighter text-primary">
            Challenge Friends, Not The House
          </h1>
          <p className="mt-4 text-lg md:text-xl text-white/90 max-w-2xl mx-auto">
            Welcome to Playcer, the peer-to-peer betting exchange where the competition is personal.
          </p>
          <div className="mt-8">
              <Link href="/marketplace">
                <Button size="lg">Explore Betting Events</Button>
              </Link>
          </div>
        </div>
      </header>
    </main>
  );
}
