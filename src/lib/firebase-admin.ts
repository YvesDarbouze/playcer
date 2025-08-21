
import * as admin from 'firebase-admin';
import { applicationDefault } from 'firebase-admin/app';

let app: admin.app.App | undefined;

// This ensures we initialize the app only once
if (!admin.apps.length) {
  try {
    // In a Google-managed environment (like App Hosting), use applicationDefault()
    // It automatically finds the correct credentials.
    app = admin.initializeApp({
        credential: applicationDefault(),
    });
    console.log("Firebase Admin SDK initialized successfully via applicationDefault().");
  } catch (error: any) {
    console.error('Firebase admin initialization error with applicationDefault(). This might happen in a local dev environment without gcloud auth. Falling back to env vars.', error.message);
    // Fallback for local development or environments where GOOGLE_APPLICATION_CREDENTIALS is not set.
    if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
        try {
            app = admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
                }),
            });
             console.log("Firebase Admin SDK initialized successfully via environment variables.");
        } catch (fallbackError: any) {
             console.error('Firebase admin fallback initialization error', fallbackError.stack);
        }
    } else {
        console.warn("Firebase Admin credentials are not set in environment variables. Server-side features will be limited.");
    }
  }
} else {
  app = admin.app();
}

const firestore = () => {
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
