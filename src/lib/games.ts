
import { collection, getDocs, query, orderBy, Timestamp } from "firebase/firestore";
import { firestore as getFirestoreAdmin } from "@/lib/firebase-admin";
import { getFirebaseApp } from "@/lib/firebase";
import { getFirestore as getClientFirestore } from "firebase/firestore";
import type { Game } from "@/types";

// Server-side function using the Admin SDK
export async function getGames(): Promise<Game[]> {
  try {
    const firestore = getFirestoreAdmin();
    if (!firestore) {
      console.error("Firestore Admin SDK not initialized. Game data cannot be fetched on the server because FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY environment variables are not set.");
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


// Client-side function using the Web SDK
export async function getClientGames(): Promise<Game[]> {
  try {
    const firestore = getClientFirestore(getFirebaseApp());
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
