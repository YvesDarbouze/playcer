
import { collection, getDocs, query, where, orderBy, Timestamp } from "firebase/firestore";
import { firestore as getFirestore } from "@/lib/firebase-admin"; // Using admin SDK for server-side fetches
import type { Bet } from "@/types";
import { MarketplaceFeed } from "@/components/marketplace-feed";
import { Logo } from "@/components/icons";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LayoutDashboard } from "lucide-react";
import { LoginButton } from "@/components/login-button";

export const dynamic = 'force-dynamic';

async function getOpenBets(): Promise<Bet[]> {
  try {
    const firestore = getFirestore();
    if (!firestore) {
      console.log("Firestore not initialized");
      return [];
    }
    const betsRef = collection(firestore, "bets");
    const q = query(
      betsRef,
      where("isPublic", "==", true),
      where("status", "==", "pending_acceptance"),
      orderBy("createdAt", "desc")
    );

    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      // Convert Firestore Timestamps to serializable strings for the client
      return {
        ...data,
        id: doc.id,
        gameDetails: {
            ...data.gameDetails,
            commence_time: (data.gameDetails.commence_time as Timestamp).toDate().toISOString(),
        },
        createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
        settledAt: data.settledAt ? (data.settledAt as Timestamp).toDate().toISOString() : null,
      } as unknown as Bet;
    });

  } catch (error) {
    console.error("Error fetching open bets:", error);
    return [];
  }
}

export default async function MarketplacePage() {
  const openBets = await getOpenBets();

  return (
    <main className="bg-muted/40 min-h-screen">
       <div className="container mx-auto p-4 md:p-8">
            <header className="py-4 px-6 mb-8 rounded-lg shadow-md bg-card border">
                 <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                     <div className="flex items-center gap-3">
                        <Logo className="size-10 text-primary" />
                        <div>
                            <h1 className="text-2xl md:text-3xl font-headline font-black text-foreground">
                                Bet Marketplace
                            </h1>
                             <p className="text-muted-foreground">Find and accept open challenges</p>
                        </div>
                    </div>
                     <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
                         <Link href="/dashboard" className="flex-1 sm:flex-initial" passHref>
                           <Button variant="outline" className="w-full">
                             <LayoutDashboard className="mr-2 h-4 w-4" />
                             My Dashboard
                           </Button>
                         </Link>
                         <div className="flex-1 sm:flex-initial">
                            <LoginButton />
                         </div>
                     </div>
                 </div>
            </header>

            <MarketplaceFeed initialBets={openBets} />
       </div>
    </main>
  );
}
