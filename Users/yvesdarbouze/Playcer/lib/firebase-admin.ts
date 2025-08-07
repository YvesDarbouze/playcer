
import * as admin from 'firebase-admin';

let app: admin.app.App;

// This check ensures the code only runs on the server
if (typeof window === 'undefined') {
  if (!admin.apps.length) {
    try {
      // When deployed, GOOGLE_APPLICATION_CREDENTIALS will be set
      if (process.env.NEXT_PUBLIC_VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production') {
        app = admin.initializeApp();
      } else {
        // For local development, use the service account file
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY as string);
        app = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
      }
    } catch (error: any) {
      console.error('Firebase admin initialization error', error.stack);
    }
  } else {
    app = admin.app();
  }
}


const firestore = () => {
    if (!app) return null;
    return admin.firestore(app);
}

const auth = () => {
    if (!app) return null;
    return admin.auth(app);
}

export { firestore, auth };
