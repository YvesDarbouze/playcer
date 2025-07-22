
import * as admin from 'firebase-admin';

let app: admin.app.App;

if (!admin.apps.length) {
  try {
    app = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      }),
    });
  } catch (error: any) {
    console.error('Firebase admin initialization error', error.stack);
  }
} else {
  app = admin.app();
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
