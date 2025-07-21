import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <main className="flex-1">
        {/* Hero Section */}
        <section className="bg-primary text-primary-foreground py-20 px-4 flex flex-col items-center justify-center text-center min-h-[50vh] relative">
          <nav className="absolute top-4 right-4">
            <Button variant="destructive">Login with Twitter</Button>
          </nav>
          
          <div className="max-w-4xl mx-auto">
            <h1 className="font-headline text-4xl md:text-6xl uppercase font-bold tracking-tight">
              I don&apos;t just want to Bet, I Want To Bet That M0+#%
            </h1>
            <p className="mt-4 text-lg md:text-xl text-primary-foreground/80">
              Peer to Peer Betting that makes sports betting personal
            </p>
          </div>
        </section>

        {/* Content Section */}
        <section className="py-16 px-4">
          <div className="container mx-auto">
            <h2 className="text-3xl font-bold text-center mb-8">Upcoming Games</h2>
            <div className="p-12 border-2 border-dashed rounded-lg text-center text-muted-foreground">
              <p>Game listings will appear here.</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
