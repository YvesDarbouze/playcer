import {initializeApp} from "firebase-admin/app";
import {getFirestore, Timestamp, FieldValue} from "firebase-admin/firestore";
import {onUserCreate} from "firebase-functions/v2/auth";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import {logger} from "firebase-functions";
import { v4 as uuidv4 } from "uuid";

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


export const createBet = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'You must be logged in to create a bet.');
    }

    const { uid } = request.auth;
    const {
        sportKey,
        eventId,
        eventDate,
        homeTeam,
        awayTeam,
        betType,
        line,
        odds,
        teamSelection,
        stake
    } = request.data;
    
    // Basic validation
    if (!sportKey || !eventId || !eventDate || !homeTeam || !awayTeam || !betType || !teamSelection || !stake) {
        throw new HttpsError('invalid-argument', 'Missing required bet information.');
    }

    try {
        const userDocRef = db.collection('users').doc(uid);
        const userDoc = await userDocRef.get();

        if (!userDoc.exists) {
            throw new HttpsError('not-found', 'User profile not found.');
        }
        const userData = userDoc.data()!;

        const betId = uuidv4();
        const baseUrl = 'https://playcer-mvp.web.app'; // Replace with your actual domain
        const uniqueLink = `${baseUrl}/bet/${betId}`;

        const newBet = {
            creatorId: uid,
            creatorUsername: userData.username,
            creatorPhotoURL: userData.photoURL,
            challengerId: null,
            challengerUsername: null,
            challengerPhotoURL: null,
            sportKey,
            eventId,
            eventDate: Timestamp.fromDate(new Date(eventDate)),
            homeTeam,
            awayTeam,
            betType,
            line: line ?? null,
            odds,
            teamSelection,
            stake,
            status: 'open',
            winnerId: null,
            createdAt: Timestamp.now(),
            uniqueLink,
        };

        await db.collection('bets').doc(betId).set(newBet);
        
        logger.log(`Bet ${betId} created by user ${uid}`);

        return { success: true, betId, uniqueLink };

    } catch (error) {
        logger.error('Error creating bet:', error);
        if (error instanceof HttpsError) {
            throw error;
        }
        throw new HttpsError('internal', 'An unexpected error occurred while creating the bet.');
    }
});


export const acceptBet = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'You must be logged in to accept a bet.');
    }

    const { uid: challengerId } = request.auth;
    const { betId } = request.data;

    if (!betId) {
        throw new HttpsError('invalid-argument', 'The `betId` must be provided.');
    }

    try {
        const betDocRef = db.collection('bets').doc(betId);
        const challengerDocRef = db.collection('users').doc(challengerId);

        const [betDoc, challengerDoc] = await Promise.all([betDocRef.get(), challengerDocRef.get()]);

        if (!betDoc.exists) {
            throw new HttpsError('not-found', 'Bet not found.');
        }

        if (!challengerDoc.exists) {
            throw new HttpsError('not-found', 'Challenger profile not found.');
        }
        
        const betData = betDoc.data()!;
        const challengerData = challengerDoc.data()!;

        if (betData.creatorId === challengerId) {
            throw new HttpsError('failed-precondition', 'You cannot accept your own bet.');
        }

        if (betData.status !== 'open') {
            throw new HttpsError('failed-precondition', 'This bet is no longer open.');
        }

        await betDocRef.update({
            challengerId: challengerId,
            challengerUsername: challengerData.username,
            challengerPhotoURL: challengerData.photoURL,
            status: 'matched'
        });

        logger.log(`Bet ${betId} accepted by user ${challengerId}`);

        return { success: true, message: 'Bet accepted successfully!' };

    } catch (error) {
        logger.error(`Error accepting bet ${betId}:`, error);
        if (error instanceof HttpsError) {
            throw error;
        }
        throw new HttpsError('internal', 'An unexpected error occurred while accepting the bet.');
    }
});