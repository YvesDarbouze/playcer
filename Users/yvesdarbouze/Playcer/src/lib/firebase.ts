
import { initializeApp, getApps, getApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { getAuth, TwitterAuthProvider, signOut as firebaseSignOut } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};


// Initialize Firebase
const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize App Check
if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY) {
  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY),
      isTokenAutoRefreshEnabled: true
    });
  
    // For local development, you might want to use a debug token.
    // (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  } catch (error) {
    console.error("Failed to initialize Firebase App Check", error);
  }
}


const auth = getAuth(app);
const firestore = getFirestore(app);
const storage = getStorage(app);
const twitterProvider = new TwitterAuthProvider();

const signOut = () => {
  return firebaseSignOut(auth);
}

export function getFirebaseApp() {
    return app;
}

export { app, auth, firestore, storage, twitterProvider, signOut };

