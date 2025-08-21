
import {initializeApp} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import {getFirestore, Timestamp, FieldValue} from "firebase-admin/firestore";
import {onUserCreate} from "firebase-functions/v2/auth";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as functions from "firebase-functions";
import { v4 as uuidv4 } from "uuid";
import * as algoliasearch from 'algoliasearch';
import fetch from "node-fetch";
import Stripe from "stripe";
import * as crypto from "crypto";
import { startStreaming } from "./stream";


// Initialize Algolia client
// Ensure you have set these environment variables in your Firebase project configuration
const algoliaClient = algoliasearch.default(process.env.ALGOLIA_APP_ID!, process.env.ALGOLIA_API_KEY!);
const gamesIndex = algoliaClient.initIndex('games');
const betsIndex = algoliaClient.initIndex('bets');


// Initialize Firebase Admin SDK
initializeApp();
const db = getFirestore();
const auth = getAuth();

// Initialize Stripe SDK
// Ensure you have set STRIPE_API_KEY environment variable
const stripe = new Stripe(process.env.STRIPE_API_KEY!, {
    apiVersion: '2024-06-20',
});

// Start the real-time event streaming service
startStreaming();


// --- DATABASE TRIGGERS ---

export const onGameWritten = functions.firestore
    .document('games/{gameId}')
    .onWrite(async (change, context) => {
        const { gameId } = context.params;

        if (!change.after.exists()) {
            // Document was deleted
            try {
                await gamesIndex.deleteObject(gameId);
                functions.logger.log(`[Algolia] Deleted game ${gameId}`);
            } catch (error) {
                functions.logger.error(`[Algolia] Error deleting game ${gameId}:`, error);
            }
            return;
        }

        // Document was created or updated
        const gameData = change.after.data();
        const record = {
            objectID: gameId,
            home_team: gameData.home_team,
            away_team: gameData.away_team,
            sport_title: gameData.sport_title,
            commence_time: gameData.commence_time.toMillis(),
        };

        try {
            await gamesIndex.saveObject(record);
            functions.logger.log(`[Algolia] Saved/updated game ${gameId}`);
        } catch (error) {
            functions.logger.error(`[Algolia] Error saving game ${gameId}:`, error);
        }
    });

export const onBetWritten = functions.firestore
    .document('bets/{betId}')
    .onWrite(async (change, context) => {
        const { betId } = context.params;

        if (!change.after.exists()) {
            // Document was deleted
            try {
                await betsIndex.deleteObject(betId);
                functions.logger.log(`[Algolia] Deleted bet ${betId}`);
            } catch (error) {
                functions.logger.error(`[Algolia] Error deleting bet ${betId}:`, error);
            }
            return;
        }

        const betData = change.after.data() as any;

        // If the bet is no longer public or pending, remove it from the search index
        if (!betData.isPublic || betData.status !== 'pending') {
             try {
                await betsIndex.deleteObject(betId);
                functions.logger.log(`[Algolia] Deleted non-public/non-pending bet ${betId}`);
            } catch (error) {
                functions.logger.error(`[Algolia] Error deleting bet ${betId} from index:`, error);
            }
            return;
        }

        // Document was created or updated and is searchable
        const record = {
            objectID: betId,
            homeTeam: betData.homeTeam,
            awayTeam: betData.awayTeam,
            challengerUsername: betData.challengerUsername,
            totalWager: betData.totalWager,
            remainingWager: betData.remainingWager,
            betType: betData.betType,
            chosenOption: betData.chosenOption,
            line: betData.line,
            odds: betData.odds,
            allowFractionalAcceptance: betData.allowFractionalAcceptance,
            createdAt: betData.createdAt.toMillis(),
        };

        try {
            await betsIndex.saveObject(record);
            functions.logger.log(`[Algolia] Saved/updated bet ${betId}`);
        } catch (error) {
            functions.logger.error(`[Algolia] Error saving bet ${betId}:`, error);
        }
    });


// --- THIRD-PARTY SERVICES ---

const sportsDataAPI = {
     async getEventResult(sportKey: string, eventId: string): Promise<{ home_score: number, away_score: number, status: 'Final' | 'InProgress' }> {
        functions.logger.log(`Fetching result for event ${eventId} from sports data oracle.`);
        // In a real application, this would fetch from a live API.
        // For this MVP, we simulate a final score to test settlement logic.
        const home_score = Math.floor(Math.random() * 40) + 70; // Simulate a score between 70-110
        const away_score = Math.floor(Math.random() * 40) + 70; // Simulate a score between 70-110
        
        // Randomly decide if the game is over to allow testing of in-progress games.
        if (Math.random() > 0.1) { // 90% chance of being 'Final' for testing
             return { home_score, away_score, status: 'Final' };
        }
        return { home_score: 0, away_score: 0, status: 'InProgress' };
    }
}

// --- AUTHENTICATION TRIGGERS ---

export const onusercreate = onUserCreate(async (event) => {
  const user = event.data;
  const {uid, displayName, photoURL, email} = user;

  const twitterProvider = user.providerData.find(p => p.providerId === 'twitter.com');
  // @ts-ignore
  const username = twitterProvider?.screenName || displayName?.replace(/\s+/g, '_').toLowerCase() || `user_${uid.substring(0, 5)}`;


  const userDocRef = db.collection("users").doc(uid);

  try {
    await userDocRef.set({
      displayName: displayName || `User ${uid.substring(0, 5)}`,
      username: username,
      photoURL: photoURL || "",
      email: email || "",
      createdAt: Timestamp.now(),
      walletBalance: 100.00, // Starting balance for demo purposes
      wins: 0,
      losses: 0,
      totalBets: 0,
      rankingScore: 0,
      kycStatus: "pending", // All new users start as 'pending'
      responsibleGamingLimits: {
        deposit: { daily: 0, weekly: 0, monthly: 0 },
        wager: { daily: 0, weekly: 0, monthly: 0 },
      },
      selfExclusion: {
        isActive: false,
        startDate: null,
        endDate: null,
      },
    });
    functions.logger.log("User document created successfully for UID:", uid);
  } catch (error) {
    functions.logger.error("Error creating user document for UID:", uid, error);
  }
});


// --- HTTP CALLABLE FUNCTIONS ---

export const getAlgoliaSearchKey = onCall((request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'You must be logged in to search.');
    }
    
    const searchKey = algoliasearch.generateSecuredApiKey(
        process.env.ALGOLIA_SEARCH_ONLY_API_KEY!,
        {
             filters: 'status:pending'
        }
    );

    return { key: searchKey };
});

export const createBetPaymentIntent = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'You must be logged in to create a payment intent.');
    }
    const { uid } = request.auth;
    const { wagerAmount } = request.data;

    if (typeof wagerAmount !== 'number' || wagerAmount <= 0) {
        throw new HttpsError('invalid-argument', 'A valid wager amount is required.');
    }

    try {
        const paymentIntent = await stripe.paymentIntents.create({
            amount: wagerAmount * 100, // Stripe works in cents
            currency: 'usd',
            capture_method: 'manual', // Authorize now, capture later
            metadata: {
                userId: uid,
                type: 'bet_authorization'
            }
        });

        functions.logger.log(`Successfully created payment intent ${paymentIntent.id} for user ${uid}.`);
        return { success: true, clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id };
    } catch (error: any) {
        functions.logger.error(`Error creating payment intent for user ${uid}:`, error);
        throw new HttpsError('internal', error.message);
    }
});


export const handleDeposit = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'You must be logged in to make a deposit.');
    }
    const { uid } = request.auth;
    const { depositAmount } = request.data;

    if (typeof depositAmount !== 'number' || depositAmount <= 0) {
        throw new HttpsError('invalid-argument', 'A valid deposit amount is required.');
    }
    
    const userDocRef = db.collection('users').doc(uid);
    const userDoc = await userDocRef.get();
    if (!userDoc.exists) {
        throw new HttpsError('not-found', 'User profile not found.');
    }
    const userData = userDoc.data()!;

    if (userData.selfExclusion?.isActive === true) {
        throw new HttpsError('failed-precondition', 'Your account is currently in a self-exclusion period. You cannot make a deposit.');
    }
    
    try {
        const paymentIntent = await stripe.paymentIntents.create({
            amount: depositAmount * 100, // Stripe works in cents
            currency: 'usd',
            automatic_payment_methods: { enabled: true },
            metadata: {
                userId: uid,
                type: 'wallet_deposit'
            }
        });
        
        functions.logger.log(`Successfully created deposit payment intent ${paymentIntent.id} for user ${uid}.`);
        return { success: true, clientSecret: paymentIntent.client_secret };

    } catch (error: any) {
        functions.logger.error(`Error handling deposit for user ${uid}:`, error);
        throw new HttpsError('internal', error.message);
    }
});


export const createBet = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'You must be logged in to create a bet.');
    }

    const { uid: challengerId } = request.auth;
    const {
        eventId,
        eventDate,
        homeTeam,
        awayTeam,
        betType,
        totalWager,
        chosenOption,
        line,
        isPublic,
        twitterShareUrl,
        bookmakerKey,
        odds,
        allowFractionalAcceptance,
        challengerPaymentIntentId,
    } = request.data;
    
    // Basic validation
    if (!eventId || !eventDate || !homeTeam || !awayTeam || !betType || !chosenOption || totalWager === undefined || !bookmakerKey || odds === undefined || !challengerPaymentIntentId) {
        throw new HttpsError('invalid-argument', 'Missing required bet information.');
    }

    if (isPublic === false && !twitterShareUrl) {
        throw new HttpsError('invalid-argument', 'A twitter handle is required for a private challenge.');
    }
    
    if (typeof totalWager !== 'number' || totalWager <= 0) {
        throw new HttpsError('invalid-argument', 'The wager amount must be a positive number.');
    }

    const userDocRef = db.collection('users').doc(challengerId);
    
    return db.runTransaction(async (transaction) => {
        const userDoc = await transaction.get(userDocRef);
        if (!userDoc.exists) {
            throw new HttpsError('not-found', 'User profile not found.');
        }
        const userData = userDoc.data()!;

        if (userData.kycStatus !== 'verified') {
            throw new HttpsError('failed-precondition', 'You must verify your identity to create a bet.');
        }
        
        const betId = uuidv4();
        const newBet = {
            id: betId,
            eventId,
            eventDate: Timestamp.fromDate(new Date(eventDate)),
            homeTeam,
            awayTeam,
            challengerId: challengerId,
            challengerPaymentIntentId: challengerPaymentIntentId,
            accepters: [],
            challengerUsername: userData.username,
            challengerPhotoURL: userData.photoURL,
            totalWager,
            remainingWager: totalWager,
            betType,
            chosenOption,
            line,
            status: 'pending',
            isPublic: isPublic,
            twitterShareUrl: twitterShareUrl ? twitterShareUrl.replace('[betId]', betId) : null,
            winnerId: null,
            loserId: null,
            createdAt: Timestamp.now(),
            settledAt: null,
            outcome: null,
            bookmakerKey,
            odds,
            allowFractionalAcceptance: allowFractionalAcceptance || false,
        };

        const betDocRef = db.collection('bets').doc(betId);
        transaction.set(betDocRef, newBet);
        
        functions.logger.log(`Bet ${betId} created by user ${challengerId}`);
        return { success: true, betId };
    });
});


export const acceptBet = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'You must be logged in to accept a bet.');
    }

    const { uid: accepterId } = request.auth;
    const { betId, acceptedAmount } = request.data;
    if (!betId) throw new HttpsError('invalid-argument', 'The `betId` must be provided.');
    if (typeof acceptedAmount !== 'number' || acceptedAmount <= 0) {
        throw new HttpsError('invalid-argument', 'A valid accepted amount is required.');
    }
   
    // Create payment intent for the recipient
    try {
        const paymentIntent = await stripe.paymentIntents.create({
            amount: acceptedAmount * 100, // Stripe works in cents
            currency: 'usd',
            capture_method: 'manual', // Authorize now, capture later on confirmation
            metadata: {
                userId: accepterId,
                type: 'bet_authorization',
                betId: betId,
                acceptedAmount: acceptedAmount
            }
        });
        
        // This is a two-step process. First, we send the clientSecret back.
        // The client confirms the payment. A webhook will finalize the bet.
        return { success: true, clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id };

    } catch (error: any) {
        functions.logger.error(`Error creating recipient payment intent for bet ${betId}:`, error);
        throw new HttpsError('internal', error.message);
    }
});

export const cancelBet = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'You must be logged in to cancel a bet.');
    }

    const { uid } = request.auth;
    const { betId } = request.data;
    if (!betId) {
        throw new HttpsError('invalid-argument', 'A `betId` must be provided.');
    }

    const betDocRef = db.collection('bets').doc(betId);

    return db.runTransaction(async (transaction) => {
        const betDoc = await transaction.get(betDocRef);
        if (!betDoc.exists) {
            throw new HttpsError('not-found', 'Bet not found.');
        }

        const betData = betDoc.data()!;

        if (betData.challengerId !== uid) {
            throw new HttpsError('permission-denied', 'Only the creator can cancel this bet.');
        }

        if (betData.status !== 'pending') {
            throw new HttpsError('failed-precondition', `Cannot cancel a bet with status '${betData.status}'.`);
        }
        
        if (betData.accepters && betData.accepters.length > 0) {
            throw new HttpsError('failed-precondition', 'Cannot cancel a bet that has been partially or fully accepted.');
        }
        
        // If all checks pass, cancel the Stripe Payment Intent
        try {
            await stripe.paymentIntents.cancel(betData.challengerPaymentIntentId);
            functions.logger.log(`Successfully canceled Payment Intent ${betData.challengerPaymentIntentId} for bet ${betId}.`);
        } catch (error: any) {
            functions.logger.error(`Failed to cancel Stripe Payment Intent ${betData.challengerPaymentIntentId} for bet ${betId}:`, error);
            // Even if Stripe fails, we might still want to cancel the bet in our system
            // to prevent it from being accepted. This depends on business logic.
            // For now, we'll throw an error and stop.
            throw new HttpsError('internal', 'Could not cancel payment authorization.');
        }

        // Update the bet status to 'canceled'
        transaction.update(betDocRef, { status: 'canceled' });
        
        functions.logger.log(`Bet ${betId} has been canceled by user ${uid}.`);
        return { success: true };
    });
});


export const processBetOutcomes = onSchedule("every 15 minutes", async (event) => {
    functions.logger.log("Starting processBetOutcomes scheduled job...");
    
    const now = Timestamp.now();
    const query = db.collection('bets')
        .where('status', '==', 'active')
        .where('eventDate', '<=', now);
        
    const activeBetsSnap = await query.get();

    if (activeBetsSnap.empty) {
        functions.logger.log("No active bets found for processing.");
        return null;
    }

    let processedCount = 0;

    for (const betDoc of activeBetsSnap.docs) {
        const betId = betDoc.id;
        const betData = betDoc.data() as any; 

        try {
            const result = await sportsDataAPI.getEventResult(betData.sportKey, betData.eventId);

            if (result.status === 'Final') {
                let winnerId: string | null = null;
                let loserId: string | null = null;
                const { home_score, away_score } = result;
                
                // This simplified logic assumes a single accepter for a non-fractional bet
                const accepter = betData.accepters[0];
                if (!accepter) {
                     functions.logger.warn(`Bet ${betId} is active but has no accepters. Skipping.`);
                     continue;
                }
                const challengerId = betData.challengerId;
                const accepterId = accepter.accepterId;

                let challengerWon = false;

                if (betData.betType === 'moneyline') {
                    if (home_score === away_score) { // Push condition for moneyline
                        winnerId = null; 
                        loserId = null;
                    } else {
                        const winningTeamName = home_score > away_score ? betData.homeTeam : betData.awayTeam;
                        challengerWon = (betData.chosenOption === winningTeamName);
                    }
                } else if (betData.betType === 'spread') {
                    const pickedTeamIsHome = betData.chosenOption === betData.homeTeam;
                    // For spread, the line is negative for the favorite and positive for the underdog.
                    // We add the line to the team that was picked to see if they cover.
                    const effectiveHomeScore = pickedTeamIsHome ? (home_score + betData.line) : home_score;
                    const effectiveAwayScore = !pickedTeamIsHome ? (away_score - betData.line) : away_score;
                    
                    if (effectiveHomeScore > effectiveAwayScore) {
                        challengerWon = pickedTeamIsHome;
                    } else if (effectiveAwayScore > effectiveHomeScore) {
                        challengerWon = !pickedTeamIsHome;
                    } else { // Push condition for spreads
                        winnerId = null;
                        loserId = null;
                    }
                } else if (betData.betType === 'totals') {
                    const totalScore = home_score + away_score;
                     if (totalScore === betData.line) { // Push condition for totals
                        winnerId = null;
                        loserId = null;
                     } else {
                        challengerWon = (betData.chosenOption === 'Over' && totalScore > betData.line) ||
                                      (betData.chosenOption === 'Under' && totalScore < betData.line);
                     }
                }
                
                if (winnerId === undefined) { // If not a push
                    winnerId = challengerWon ? challengerId : accepterId;
                    loserId = challengerWon ? accepterId : challengerId;
                }
                
                // Process Payout (which now handles win, loss, or push)
                await processPayout({ 
                    betId, 
                    winnerId, 
                    loserId,
                    stake: accepter.amount, // Use the accepted amount for payout calculation
                    challengerPaymentIntentId: betData.challengerPaymentIntentId,
                    accepterPaymentIntentId: accepter.paymentIntentId,
                });
                
                await betDoc.ref.update({ 
                    status: 'settled', 
                    winnerId, 
                    loserId, 
                    outcome: winnerId ? 'win' : 'draw', 
                    settledAt: Timestamp.now() 
                });
                processedCount++;

            }
        } catch (error) {
            functions.logger.error(`Failed to process outcome for bet ${betId}:`, error);
        }
    }
    
    functions.logger.log(`Finished processBetOutcomes. Processed ${processedCount} bets.`);
    return null;
});

export const expirePendingBets = onSchedule("every 15 minutes", async (event) => {
    functions.logger.log("Starting expirePendingBets scheduled job...");

    const now = Timestamp.now();
    const query = db.collection('bets')
        .where('status', '==', 'pending')
        .where('eventDate', '<=', now);

    const expiredBetsSnap = await query.get();

    if (expiredBetsSnap.empty) {
        functions.logger.log("No expired pending bets found.");
        return null;
    }

    let expiredCount = 0;

    for (const betDoc of expiredBetsSnap.docs) {
        const betId = betDoc.id;
        const betData = betDoc.data()!;

        try {
            // Cancel the creator's payment intent
            await stripe.paymentIntents.cancel(betData.challengerPaymentIntentId);
            functions.logger.log(`Canceled challenger payment intent ${betData.challengerPaymentIntentId} for expired bet ${betId}.`);

            // Cancel payment intents for any partial accepters
            if (betData.accepters && betData.accepters.length > 0) {
                 for (const accepter of betData.accepters) {
                    await stripe.paymentIntents.cancel(accepter.paymentIntentId);
                    functions.logger.log(`Canceled accepter payment intent ${accepter.paymentIntentId} for expired bet ${betId}.`);
                }
            }

            await betDoc.ref.update({ status: 'expired' });
            expiredCount++;
            
            // Notify the creator
            await createNotification(
                betData.challengerId,
                `Your bet for ${betData.awayTeam} @ ${betData.homeTeam} expired without being fully matched.`,
                `/bet/${betId}`
            );

        } catch (error: any) {
            functions.logger.error(`Failed to expire bet ${betId}:`, error);
            // If Stripe cancellation fails, we might not want to change the status,
            // so an admin can review it. For now, we'll log and continue.
        }
    }
    
    functions.logger.log(`Finished expirePendingBets. Expired ${expiredCount} bets.`);
    return null;
});


async function processPayout(data: { betId: string, winnerId: string | null, loserId: string | null, stake: number, challengerPaymentIntentId: string, accepterPaymentIntentId: string }) {
    const { betId, winnerId, loserId, stake, challengerPaymentIntentId, accepterPaymentIntentId } = data;
    const PLATFORM_COMMISSION_RATE = 0.045; // 4.5% vig
    
    const betDocSnap = await db.collection('bets').doc(betId).get();
    if (!betDocSnap.exists) {
        functions.logger.error(`Bet document ${betId} not found during payout.`);
        return;
    }
    const betData = betDocSnap.data()!;
    
    if(winnerId && loserId) {
        const winnerIsChallenger = winnerId === betData.challengerId;

        // This logic assumes a single accepter for simplicity of determining winner/loser PI.
        // For multiple accepters, this would need to iterate through them.
        const winnerPI = winnerIsChallenger ? challengerPaymentIntentId : accepterPaymentIntentId;
        const loserPI = winnerIsChallenger ? accepterPaymentIntentId : challengerPaymentIntentId;

        try {
            // --- Capture Loser's Funds & Release Winner's Funds ---
            await Promise.all([
                stripe.paymentIntents.capture(loserPI),
                stripe.paymentIntents.cancel(winnerPI)
            ]);
            functions.logger.log(`Successfully captured loser's PI (${loserPI}) and canceled winner's PI (${winnerPI}) for bet ${betId}.`);

            // --- Database Updates for Payout ---
            const commission = stake * PLATFORM_COMMISSION_RATE;
            const payoutToWinner = stake - commission;
            
            const winnerDocRef = db.collection('users').doc(winnerId);
            const loserDocRef = db.collection('users').doc(loserId);

            await db.runTransaction(async (transaction) => {
                transaction.update(winnerDocRef, { 
                    walletBalance: FieldValue.increment(payoutToWinner),
                    wins: FieldValue.increment(1),
                    totalBets: FieldValue.increment(1)
                });
                transaction.update(loserDocRef, { 
                    losses: FieldValue.increment(1),
                    totalBets: FieldValue.increment(1) 
                });

                const payoutTxId = db.collection('transactions').doc().id;
                transaction.set(db.collection('transactions').doc(payoutTxId), {
                    userId: winnerId, type: 'bet_payout', amount: payoutToWinner, status: 'completed', relatedBetId: betId, createdAt: Timestamp.now()
                });
            });

             // Notify users
            await createNotification(winnerId, `You won $${payoutToWinner.toFixed(2)} on your bet for ${betData.awayTeam} @ ${betData.homeTeam}!`, `/bet/${betId}`);
            await createNotification(loserId, `You lost your $${stake.toFixed(2)} bet for ${betData.awayTeam} @ ${betData.homeTeam}.`, `/bet/${betId}`);
            
        } catch(error) {
             functions.logger.error(`Failed to capture/release funds or process payout for bet ${betId}. Loser PI: ${loserPI}, Winner PI: ${winnerPI}`, error);
        }

    } else {
        // --- This is a PUSH. Cancel all authorizations. ---
        try {
            const cancellationPromises = [stripe.paymentIntents.cancel(challengerPaymentIntentId)];
            if(betData.accepters && betData.accepters.length > 0) {
                 betData.accepters.forEach((accepter: any) => {
                    cancellationPromises.push(stripe.paymentIntents.cancel(accepter.paymentIntentId));
                });
            }
            
            await Promise.all(cancellationPromises);

            functions.logger.log(`Push for bet ${betId}. Canceled all payment intents.`);
            
             // Notify users
            await createNotification(betData.challengerId, `Your bet on ${betData.awayTeam} @ ${betData.homeTeam} was a push. Your funds authorization has been released.`, `/bet/${betId}`);
            if(betData.accepters && betData.accepters.length > 0) {
                 for (const accepter of betData.accepters) {
                    await createNotification(accepter.accepterId, `Your bet on ${betData.awayTeam} @ ${betData.homeTeam} was a push. Your funds authorization has been released.`, `/bet/${betId}`);
                }
            }

        } catch (error) {
            functions.logger.error(`Failed to cancel payment intents for push on bet ${betId}.`, error);
        }
    }

    functions.logger.log(`Payout logic for bet ${betId} processed.`);
}
    

export const stripeWebhook = functions.https.onRequest(async (request, response) => {
    const signature = request.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!signature || !webhookSecret) {
        response.status(400).send('Webhook Error: Missing signature or secret.');
        return;
    }

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(request.rawBody, signature, webhookSecret);
    } catch (err: any) {
        functions.logger.error('Webhook signature verification failed.', err.message);
        response.status(400).send(`Webhook Error: ${err.message}`);
        return;
    }

    switch (event.type) {
        case 'payment_intent.succeeded':
            const piSucceeded = event.data.object as Stripe.PaymentIntent;
            if (piSucceeded.metadata.type === 'wallet_deposit') {
                functions.logger.info(`Processing successful wallet deposit for user ${piSucceeded.metadata.userId}`);
                const amount = piSucceeded.amount_received / 100;
                
                const userDocRef = db.collection('users').doc(piSucceeded.metadata.userId);
                const transactionDocRef = db.collection('transactions').doc();

                await db.runTransaction(async (transaction) => {
                    transaction.update(userDocRef, { walletBalance: FieldValue.increment(amount) });
                    transaction.set(transactionDocRef, {
                        userId: piSucceeded.metadata.userId,
                        type: 'deposit',
                        amount: amount,
                        status: 'completed',
                        gatewayTransactionId: piSucceeded.id,
                        createdAt: Timestamp.now(),
                    });
                });
                functions.logger.info(`Successfully updated wallet balance for user ${piSucceeded.metadata.userId}.`);
            }
            break;

        case 'payment_intent.payment_failed':
            const piFailed = event.data.object as Stripe.PaymentIntent;
            functions.logger.warn(`Payment failed for user ${piFailed.metadata.userId} for intent ${piFailed.id}.`);
            // Here you might want to send a notification to the user
            break;

        case 'payment_intent.requires_capture':
            const piToCapture = event.data.object as Stripe.PaymentIntent;
            const { userId: accepterId, betId, acceptedAmount } = piToCapture.metadata;

            if (piToCapture.metadata.type === 'bet_authorization' && betId && accepterId && acceptedAmount) {
                functions.logger.info(`Finalizing bet acceptance for bet ${betId} by taker ${accepterId} for amount ${acceptedAmount}.`);
                
                const betDocRef = db.collection('bets').doc(betId);
                const accepterDocRef = db.collection('users').doc(accepterId);

                await db.runTransaction(async (transaction) => {
                    const betDoc = await transaction.get(betDocRef);
                    const accepterDoc = await transaction.get(accepterDocRef);
                    
                    if (!betDoc.exists) throw new Error(`Bet ${betId} not found.`);
                    if (!accepterDoc.exists) throw new Error(`Accepter ${accepterId} not found.`);

                    const betData = betDoc.data()!;
                    const accepterData = accepterDoc.data()!;
                    const { challengerId, status } = betData;

                    if (status !== 'pending') throw new Error(`Bet ${betId} is not pending acceptance.`);
                    if (challengerId === accepterId) throw new Error('User cannot accept their own bet.');
                    if (accepterData.kycStatus !== 'verified') throw new HttpsError('failed-precondition', 'You must be KYC verified to accept a bet.');

                    const numericAcceptedAmount = Number(acceptedAmount);
                    if (isNaN(numericAcceptedAmount) || numericAcceptedAmount <= 0) {
                        throw new Error('Invalid accepted amount.');
                    }
                    if(numericAcceptedAmount > betData.remainingWager) {
                        throw new Error('Accepted amount exceeds remaining wager.');
                    }
                    
                    // Update bet document
                    const newRemainingAmount = betData.remainingWager - numericAcceptedAmount;
                    const newStatus = newRemainingAmount <= 0 ? 'active' : 'pending';
                    
                    const newAccepter = {
                        accepterId,
                        accepterUsername: accepterData.username,
                        accepterPhotoURL: accepterData.photoURL,
                        amount: numericAcceptedAmount,
                        paymentIntentId: piToCapture.id, // Store the PI for later capture/cancellation
                        createdAt: Timestamp.now()
                    };

                    transaction.update(betDocRef, {
                        remainingWager: newRemainingAmount,
                        status: newStatus,
                        accepters: FieldValue.arrayUnion(newAccepter)
                    });
                    
                    // Create Notification for the bet creator
                    await createNotification(
                        challengerId,
                        `Your challenge for ${betData.awayTeam} @ ${betData.homeTeam} was accepted by @${accepterData.username} for $${numericAcceptedAmount.toFixed(2)}!`,
                        `/bet/${betId}`
                    );
                });
                functions.logger.log(`Bet acceptance for ${betId} successfully processed.`);
            }
            break;
            
        case 'payment_intent.canceled':
            const piCanceled = event.data.object as Stripe.PaymentIntent;
            functions.logger.info(`Payment intent ${piCanceled.id} was canceled.`);
            // This event is useful for logging and reconciliation. If a bet was associated
            // with this payment intent, its status should already be 'canceled' or 'expired'.
            break;

        default:
            functions.logger.warn(`Unhandled event type ${event.type}`);
    }

    response.json({received: true});
});


export const kycWebhook = functions.https.onRequest(async (request, response) => {
    const kycWebhookSecret = process.env.KYC_WEBHOOK_SECRET;

    const signature = request.headers['x-kyc-provider-signature'];
    if (kycWebhookSecret) {
         const expectedSignature = crypto
            .createHmac('sha256', kycWebhookSecret)
            .update(JSON.stringify(request.body))
            .digest('hex');
         
         if (signature !== expectedSignature) {
            functions.logger.error("Invalid KYC webhook signature.");
            response.status(403).send("Signature verification failed.");
            return;
         }
    } else {
        functions.logger.warn("KYC_WEBHOOK_SECRET not set. Skipping signature verification. THIS IS NOT SAFE FOR PRODUCTION.");
    }
    const { event, data } = request.body;

    if (event === 'verification.completed') {
        const { userId, status, details } = data; 
        
        if (!userId) {
            functions.logger.error("Received KYC webhook without a userId.");
            response.status(400).send("Missing userId in payload.");
            return;
        }

        const userDocRef = db.collection("users").doc(userId);
        
        try {
            let newKycStatus: 'verified' | 'rejected' | 'in_review' = 'in_review';
            if (status === 'approved') {
                newKycStatus = 'verified';
            } else if (status === 'declined') {
                newKycStatus = 'rejected';
            }

            await userDocRef.update({ 
                kycStatus: newKycStatus,
                kycDetails: details 
            });

            functions.logger.log(`Successfully updated KYC status for user ${userId} to ${newKycStatus}.`);

        } catch(error) {
            functions.logger.error(`Error updating KYC status for user ${userId}:`, error);
            response.status(500).send("Internal server error.");
            return;
        }
    }

    response.status(200).send({ received: true });
});

export const markNotificationsAsRead = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'You must be logged in.');
    }
    const { uid } = request.auth;
    const notificationsRef = db.collection('users').doc(uid).collection('notifications');
    const unreadQuery = notificationsRef.where('isRead', '==', false);

    try {
        const snapshot = await unreadQuery.get();
        if (snapshot.empty) {
            return { success: true, message: "No unread notifications." };
        }
        
        const batch = db.batch();
        snapshot.docs.forEach(doc => {
            batch.update(doc.ref, { isRead: true });
        });
        await batch.commit();

        return { success: true, count: snapshot.size };

    } catch (error) {
        functions.logger.error("Error marking notifications as read:", error);
        throw new HttpsError('internal', 'Could not mark notifications as read.');
    }
});

async function createNotification(userId: string, message: string, link: string) {
    if (!userId) return;
    const notificationRef = db.collection('users').doc(userId).collection('notifications').doc();
    await notificationRef.set({
        id: notificationRef.id,
        userId,
        message,
        link,
        isRead: false,
        createdAt: Timestamp.now()
    });
}

// --- ADMIN FUNCTIONS ---

const ensureIsAdmin = (context: any) => {
    if (!context.auth) {
        throw new HttpsError('unauthenticated', 'You must be logged in to perform this action.');
    }
    if (context.auth.token.admin !== true) {
        throw new HttpsError('permission-denied', 'You must be an administrator to perform this action.');
    }
};

export const resolveDispute = onCall(async (request) => {
    ensureIsAdmin(request);

    const { disputeId, ruling, adminNotes } = request.data;
    if (!disputeId || !ruling || !adminNotes) {
        throw new HttpsError('invalid-argument', 'disputeId, ruling, and adminNotes are required.');
    }
    if (!['creator_wins', 'taker_wins', 'void'].includes(ruling)) {
        throw new HttpsError('invalid-argument', 'Invalid ruling provided.');
    }

    const disputeRef = db.collection('disputes').doc(disputeId);
    
    return db.runTransaction(async (transaction) => {
        const disputeDoc = await transaction.get(disputeRef);
        if (!disputeDoc.exists) {
            throw new HttpsError('not-found', 'Dispute not found.');
        }
        const disputeData = disputeDoc.data()!;
        if (disputeData.status !== 'open') {
            throw new HttpsError('failed-precondition', 'This dispute has already been resolved.');
        }
        
        const betRef = db.collection('bets').doc(disputeData.betId);
        const betDoc = await transaction.get(betRef);
        if (!betDoc.exists) {
            throw new HttpsError('not-found', `Related bet ${disputeData.betId} not found.`);
        }
        const betData = betDoc.data()!;

        // Update the dispute document first
        transaction.update(disputeRef, {
            status: 'resolved',
            resolution: { outcome: ruling, adminNotes, resolvedAt: Timestamp.now() }
        });

        if (ruling === 'void') {
            // If the bet is voided, we'll mark it as such and rely on a separate process
            // to handle any necessary fund movements or payment intent cancellations.
            transaction.update(betRef, { status: 'void', settledAt: Timestamp.now() });
            functions.logger.log(`Dispute ${disputeId} for bet ${betData.id} resolved as 'void'.`);

        } else {
            const winnerId = ruling === 'creator_wins' ? betData.creatorId : betData.takerId;
            const loserId = ruling === 'creator_wins' ? betData.takerId : betData.creatorId;

            // This is where the financial settlement would be triggered.
            // For now, we just update the bet's status and winner.
            // The actual payout logic would be called here.
             await processPayout({ 
                betId: betDoc.id, 
                winnerId: winnerId, 
                loserId: loserId,
                stake: betData.totalWager, // Assuming full wager for simplicity
                challengerPaymentIntentId: betData.challengerPaymentIntentId,
                accepterPaymentIntentId: betData.accepters[0]?.paymentIntentId, // Simplified for single accepter
            });

            transaction.update(betRef, { status: 'settled', winnerId: winnerId, loserId: loserId, settledAt: Timestamp.now() });
            functions.logger.log(`Dispute ${disputeId} for bet ${betData.id} resolved. Winner: ${winnerId}`);
        }
         // TODO: Notify users of the dispute resolution.
    }).then(() => {
        return { success: true, message: 'Dispute resolved successfully.' };
    }).catch((error) => {
        functions.logger.error(`Error resolving dispute ${disputeId}:`, error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', 'An internal error occurred while resolving the dispute.');
    });
});
