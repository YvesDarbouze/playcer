import { Logo } from "@/components/icons";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="p-4 border-b">
        <div className="container mx-auto flex items-center gap-2">
           <Logo className="size-8 text-primary" />
           <h1 className="text-xl font-bold">Playcer</h1>
        </div>
      </header>
      <main className="flex-1">
        <div className="container mx-auto py-8">
          <h2 className="text-2xl font-bold mb-4">Upcoming Games</h2>
          <div className="p-8 border-2 border-dashed rounded-lg text-center text-muted-foreground">
              <p>Game listings will appear here.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
