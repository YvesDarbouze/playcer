import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import {getFirestore} from "firebase-admin/firestore";

admin.initializeApp();

const db = getFirestore();

// This function will now work correctly with the v1 import
export const onusercreate = functions.auth.user().onCreate(async (user) => {
  const {uid, email, displayName} = user;

  try {
    await db.collection("users").doc(uid).set({
      email,
      displayName,
      createdAt: new Date(),
    });
    console.log(`User document created for UID: ${uid}`);
  } catch (error) {
    console.error(`Error creating user document for UID: ${uid}`, error);
  }
});

// This v1 HTTPS function also works correctly with the v1 import
export const getusers = functions.https.onRequest(async (req, res) => {
  try {
    const snapshot = await db.collection("users").get();
    const users = snapshot.docs.map((doc) => ({id: doc.id,...doc.data()}));
    res.status(200).json(users);
  } catch (error) {
    console.error("Error getting users:", error);
    res.status(500).send("Error getting users");
  }
});
