
import * as admin from 'firebase-admin';

let app: admin.app.App;

if (!admin.apps.length) {
  try {
    app = admin.initializeApp();
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
