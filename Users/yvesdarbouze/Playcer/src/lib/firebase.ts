
import { initializeApp, getApps, getApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { getAuth, TwitterAuthProvider, signOut as firebaseSignOut } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";

const firebaseConfig: FirebaseOptions = {
  apiKey: "AIzaSyCi9pZNU7MmgHXoYOXyS3GWJHaYQa40Etk",
  authDomain: "playcer-xbv5e.firebaseapp.com",
  projectId: "playcer-xbv5e",
  storageBucket: "playcer-xbv5e.appspot.com",
  messagingSenderId: "484911120701",
  appId: "1:484911120701:web:26fb959795a4ff8a27c554",
};


// Initialize Firebase
const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize App Check
if (typeof window !== 'undefined') {
  const appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(/* reCAPTCHA Enterprise Site Key */ "6LdymQkqAAAAAG_2G2L623nIu083rGysD-tO1tHp"),
    isTokenAutoRefreshEnabled: true
  });
  
  // For local development, you can use a debug token.
  // (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}


const auth = getAuth(app);
const firestore = getFirestore(app);
const storage = getStorage(app);
const twitterProvider = new TwitterAuthProvider();

const signOut = () => {
  return firebaseSignOut(auth);
}

export { app, auth, firestore, storage, twitterProvider, signOut };
