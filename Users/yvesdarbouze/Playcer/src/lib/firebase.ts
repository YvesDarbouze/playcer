
import { initializeApp, getApps, getApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { getAuth, TwitterAuthProvider, signOut as firebaseSignOut } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig: FirebaseOptions = {
  apiKey: "AIzaSyCi9pZNU7MmgHXoYOXyS3GWJHaYQa40Etk",
  authDomain: "playcer-xbv5e.firebaseapp.com",
  projectId: "playcer-xbv5e",
  storageBucket: "playcer-xbv5e.appspot.com",
  messagingSenderId: "484911120701",
  appId: "1:484911120701:web:26fb959795a4ff8a27c554",
};


// Initialize Firebase
let app: FirebaseApp;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

const auth = getAuth(app);
const firestore = getFirestore(app);
const storage = getStorage(app);
const twitterAuthProvider = new TwitterAuthProvider(); // Renamed to bust cache

const signOut = () => {
  return firebaseSignOut(auth);
}

// Export the initialized app instance
export const getFirebaseApp = () => app;
export { auth, firestore, storage, twitterAuthProvider, signOut };
