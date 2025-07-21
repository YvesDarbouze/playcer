import {initializeApp} from "firebase-admin/app";
import {getFirestore, Timestamp, FieldValue, Transaction} from "firebase-admin/firestore";
import {onUserCreate} from "firebase-functions/v2/auth";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import {logger} from "firebase-functions";
import { v4 as uuidv4 } from "uuid";

// Initialize Firebase Admin SDK
initializeApp();
const db = getFirestore();

// --- PLACEHOLDER PAYMENT GATEWAY ---
// In a real application, this would interact with a service like Stripe.
const paymentGateway = {
    async hasSufficientFunds(userId: string, amount: number): Promise<boolean> {
        // Placeholder: In a real app, check the user's connected payment method.
        // For this MVP, we'll assume everyone has enough funds.
        logger.log(`Checking funds for user ${userId} for amount ${amount}.`);
        return true; 
    },
    async placeAuthHold(userId: string, amount: number): Promise<{success: boolean, transactionId?: string}> {
        // Placeholder: In a real app, this would create an authorization hold.
        // For this MVP, we'll just log the action and assume success.
        logger.log(`Placing auth hold for user ${userId} for amount ${amount}.`);
        return { success: true, transactionId: `hold_${uuidv4()}`};
    }
}


export const onusercreate = onUserCreate(async (event) => {
  const user = event.data;
  const {uid, displayName, photoURL} = user;

  // Extract Twitter specific data
  const twitterProvider = user.providerData.find(
    (provider) => provider.providerId === "twitter.com"
  );

  const username = twitterProvider?.screenName || "";
  const twitterId = twitterProvider?.uid || "";


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
    if (!sportKey || !eventId || !eventDate || !homeTeam || !awayTeam || !betType || !teamSelection || stake === undefined) {
        throw new HttpsError('invalid-argument', 'Missing required bet information.');
    }
    
    if (typeof stake !== 'number' || stake <= 0) {
        throw new HttpsError('invalid-argument', 'The stake must be a positive number.');
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


export const acceptBetAndAuthPayment = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'You must be logged in to accept a bet.');
    }

    const { uid: challengerId } = request.auth;
    const { betId } = request.data;

    if (!betId) {
        throw new HttpsError('invalid-argument', 'The `betId` must be provided.');
    }

    const betDocRef = db.collection('bets').doc(betId);
    const challengerDocRef = db.collection('users').doc(challengerId);

    try {
        await db.runTransaction(async (transaction: Transaction) => {
            const betDoc = await transaction.get(betDocRef);
            const challengerDoc = await transaction.get(challengerDocRef);
            
            if (!betDoc.exists) {
                throw new HttpsError('not-found', 'Bet not found.');
            }
             if (!challengerDoc.exists) {
                throw new HttpsError('not-found', 'Challenger profile not found.');
            }

            const betData = betDoc.data()!;
            const challengerData = challengerDoc.data()!;
            const creatorId = betData.creatorId;
            const stake = betData.stake;

            if (creatorId === challengerId) {
                throw new HttpsError('failed-precondition', 'You cannot accept your own bet.');
            }

            if (betData.status !== 'open') {
                throw new HttpsError('failed-precondition', 'This bet is no longer open for challenges.');
            }

            // --- Payment Authorization Step ---
            const creatorHasFunds = await paymentGateway.hasSufficientFunds(creatorId, stake);
            const challengerHasFunds = await paymentGateway.hasSufficientFunds(challengerId, stake);

            if (!creatorHasFunds || !challengerHasFunds) {
                throw new HttpsError('failed-precondition', 'One or both users have insufficient funds.');
            }

            const creatorAuth = await paymentGateway.placeAuthHold(creatorId, stake);
            const challengerAuth = await paymentGateway.placeAuthHold(challengerId, stake);

            if (!creatorAuth.success || !challengerAuth.success) {
                // In a real app, you would also need to void the successful hold if one failed.
                throw new HttpsError('aborted', 'Payment authorization failed. The bet could not be matched.');
            }

            // --- Update Bet Document ---
            transaction.update(betDocRef, {
                challengerId: challengerId,
                challengerUsername: challengerData.username,
                challengerPhotoURL: challengerData.photoURL,
                status: 'matched'
            });
        });

        logger.log(`Bet ${betId} successfully matched by ${challengerId} with payment authorization.`);
        return { success: true, message: "Bet accepted and payment authorized!" };
    } catch (error) {
        logger.error(`Error in acceptBetAndAuthPayment transaction for bet ${betId}:`, error);
        if (error instanceof HttpsError) {
            throw error;
        }
        throw new HttpsError('internal', 'An unexpected error occurred while accepting the bet.');
    }
});

// This function is intended to be called by another backend process, like processPayouts.
// It's not directly callable from the client.
export const sendOutcomeNotification = onCall(async (request) => {
    // This function should have security checks to ensure it's only called by a trusted server process.
    // For this MVP, we'll assume it's called correctly.

    const { betId, winnerId, loserId } = request.data;
    if (!betId || !winnerId || !loserId) {
        throw new HttpsError('invalid-argument', 'Missing required arguments for notification.');
    }

    try {
        const winnerDoc = await db.collection('users').doc(winnerId).get();
        const loserDoc = await db.collection('users').doc(loserId).get();

        if (!winnerDoc.exists || !loserDoc.exists) {
            throw new HttpsError('not-found', 'Winner or loser profile not found.');
        }

        const winnerUsername = winnerDoc.data()!.username;
        const loserUsername = loserDoc.data()!.username;

        // Simulate sending notifications
        // In a real app, this would use a service like SNS, FCM, or an email provider.
        
        // 1. Congratulatory notification to the winner
        const winnerMessage = `Congratulations @${winnerUsername}! You won your bet against @${loserUsername}.`;
        logger.log(`[Notification for ${winnerId}]: ${winnerMessage}`);

        // 2. Commiseration notification to the loser
        const loserMessage = `Unfortunately, you lost your bet against @${winnerUsername}. Better luck next time!`;
        logger.log(`[Notification for ${loserId}]: ${loserMessage}`);

        // Potentially tweet from the main Playcer account
        // This requires setting up Twitter API v2 credentials for the backend.
        const playcerTweet = `A bet has been settled! Congrats to @${winnerUsername} on winning against @${loserUsername}. #Playcer`;
        logger.log(`[Playcer Tweet]: ${playcerTweet}`);


        return { success: true, message: "Outcome notifications logged." };

    } catch (error) {
        logger.error(`Error sending outcome notifications for bet ${betId}:`, error);
         if (error instanceof HttpsError) {
            throw error;
        }
        throw new HttpsError('internal', 'An unexpected error occurred while sending notifications.');
    }

});
