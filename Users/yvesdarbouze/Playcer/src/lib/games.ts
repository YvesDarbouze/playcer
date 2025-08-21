
import { collection, getDocs, query, orderBy, Timestamp } from "firebase/firestore";
import { firestore as getFirestore } from "@/lib/firebase-admin";
import type { Game } from "@/types";

export async function getGames(): Promise<Game[]> {
  try {
    const firestore = getFirestore();
    if (!firestore) {
      console.error("Firestore Admin SDK not initialized. Game data cannot be fetched on the server.");
      return [];
    }

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
    console.error("Error fetching games:", error);
    return [];
  }
}
