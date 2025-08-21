
import * as admin from 'firebase-admin';

let app: admin.app.App | undefined;

// This ensures we initialize the app only once
if (!admin.apps.length) {
  try {
    // Check if the necessary environment variables are set for a server environment
    if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
        app = admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                // The private key needs to be parsed correctly from the environment variable
                privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
            }),
        });
    } else if (process.env.FUNCTIONS_EMULATOR) {
        // This is a fallback for local development with Firebase Emulators
        // It uses the project ID from the environment.
        app = admin.initializeApp();
    }
    else {
        // This log is helpful for debugging server-side rendering issues
        console.warn("Firebase Admin SDK not initialized. Required credentials (e.g., FIREBASE_CLIENT_EMAIL) are not set. This is normal for client-side rendering but will fail in a server context.");
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
