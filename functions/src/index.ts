import {initializeApp} from "firebase-admin/app";
import {getFirestore, Timestamp} from "firebase-admin/firestore";
import {onUserCreate} from "firebase-functions/v2/auth";
import {logger} from "firebase-functions";

// Initialize Firebase Admin SDK
initializeApp();
const db = getFirestore();

export const onusercreate = onUserCreate(async (event) => {
  const user = event.data;
  const {uid, displayName, photoURL} = user;

  // Extract Twitter specific data
  const twitterProvider = user.providerData.find(
    (provider) => provider.providerId === "twitter.com"
  );

  if (!twitterProvider) {
    logger.error("Twitter provider data not found for user:", uid);
    return;
  }

  // The screenName is the user's Twitter handle
  const username = twitterProvider.screenName || "";
  const twitterId = twitterProvider.uid;


  // Create a new user document in Firestore
  const userDocRef = db.collection("users").doc(uid);

  try {
    await userDocRef.set({
      twitterId: twitterId,
      displayName: displayName || "",
      username: username,
      photoURL: photoURL || "",
      createdAt: Timestamp.now(),
      walletBalance: 0.00,
      wins: 0,
      losses: 0,
    });
    logger.log("User document created successfully for UID:", uid);
  } catch (error) {
    logger.error("Error creating user document for UID:", uid, error);
  }
});
