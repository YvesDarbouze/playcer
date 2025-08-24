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
export const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

const auth = getAuth(app);
const firestore = getFirestore(app);
const storage = getStorage(app);
const twitterProvider = new TwitterAuthProvider();

const signOut = () => {
  return firebaseSignOut(auth);
}

export { auth, firestore, storage, twitterProvider, signOut };
