
import * as admin from 'firebase-admin';

let app: admin.app.App | undefined;

// This ensures we initialize the app only once
if (!admin.apps.length) {
  try {
    // Check if the necessary environment variables are set
    if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
        app = admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                // The private key needs to be parsed correctly from the environment variable
                privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
            }),
        });
    } else {
        // This will allow the app to run in environments where server-side admin credentials are not provided
        console.warn("Firebase Admin credentials (FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY) are not set. Server-side data fetching will be disabled.");
    }
  } catch (error: any) {
    console.error('Firebase admin initialization error', error.stack);
  }
} else {
  app = admin.app();
}

const firestore = () => {
    // Only return a firestore instance if the app was successfully initialized
    if (app) {
        return admin.firestore(app);
    }
    return null;
}

const auth = () => {
    if (app) {
        return admin.auth(app);
    }
    return null;
}

export { firestore, auth };
