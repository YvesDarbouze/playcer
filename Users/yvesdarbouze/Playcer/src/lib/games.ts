import { collection, getDocs, query, orderBy, Timestamp } from "firebase/firestore";
import { firestore } from "@/lib/firebase";
import type { Game } from "@/types";

// This file is intended for client-side data fetching.
// Do not add Firebase Admin SDK code here.

// Client-side function
export async function getClientGames(): Promise<Game[]> {
  try {
    const gamesRef = collection(firestore, "games");
    const q = query(
      gamesRef,
      orderBy("commence_time", "asc")
    );
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        console.log("No games found in Firestore.");
        return [];
    }
    
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        commence_time: (data.commence_time as Timestamp).toDate().toISOString(),
      } as unknown as Game;
    });

  } catch (error) {
    console.error("Error fetching games on client:", error);
    return [];
  }
}
