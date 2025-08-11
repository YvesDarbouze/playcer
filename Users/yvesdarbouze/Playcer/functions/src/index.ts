
import {initializeApp} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import {getFirestore, Timestamp, FieldValue} from "firebase-admin/firestore";
import {onUserCreate} from "firebase-functions/v2/auth";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import * as functions from "firebase-functions";
import { v4 as uuidv4 } from "uuid";
import * as algoliasearch from 'algoliasearch';
import { generateBetImage } from "../../ai/flows/generate-bet-image";
import fetch from "node-fetch";
import Stripe from "stripe";
import * as crypto from "crypto";


// Initialize Algolia client
// Ensure you have set these environment variables in your Firebase project configuration
const algoliaClient = algoliasearch.default(process.env.ALGOLIA_APP_ID!, process.env.ALGOLIA_API_KEY!);


// Initialize Firebase Admin SDK
initializeApp();
const db = getFirestore();
const auth = getAuth();

// Initialize Stripe SDK
// Ensure you have set STRIPE_API_KEY environment variable
const stripe = new Stripe(process.env.STRIPE_API_KEY!, {
    apiVersion: '2024-06-20',
});


// --- THIRD-PARTY SERVICES ---

const sportsDataAPI = {
     async getEventResult(sportKey: string, eventId: string): Promise<{ home_score: number, away_score: number, status: 'Final' | 'InProgress' }> {
        functions.logger.log(`Fetching result for event ${eventId} from sports data oracle.`);
        const apiKey = process.env.ODDS_API_KEY;

        if (!apiKey || apiKey === '9506477182d2f2335317a695b5e875e4') {
            functions.logger.error(`CRITICAL: ODDS_API_KEY is not set. Aborting event result fetch for event ${eventId}.`);
            // Throw an error to prevent using mock data in a live environment.
            throw new Error('Sports data API key is not configured.');
        }

        try {
            const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/scores/?daysFrom=3&apiKey=${apiKey}&eventIds=${eventId}`;
            const response = await fetch(url);

            if (!response.ok) {
                functions.logger.error(`Error fetching event result from TheOddsAPI for event ${eventId}. Status: ${response.status}`);
                throw new Error('Failed to fetch from TheOddsAPI');
            }

            const data:any = await response.json();
            const eventResult = data[0];

            if (!eventResult || !eventResult.completed) {
                return { home_score: 0, away_score: 0, status: 'InProgress' };
            }

            const homeScore = parseInt(eventResult.scores.find((s: any) => s.name === eventResult.home_team)?.score || '0');
            const awayScore = parseInt(eventResult.scores.find((s: any) => s.name === eventResult.away_team)?.score || '0');

            return { home_score: homeScore, away_score: awayScore, status: 'Final' };

        } catch (error) {
            functions.logger.error(`Exception fetching event result for ${eventId}:`, error);
            // In case of any error, return a non-final status to retry later
            return { home_score: 0, away_score: 0, status: 'InProgress' };
        }
    }
}

// --- AUTHENTICATION TRIGGERS ---

export const onusercreate = onUserCreate(async (event) => {
  const user = event.data;
  const {uid, displayName, photoURL, email} = user;

  const username = displayName?.replace(/\s+/g, '_').toLowerCase() || `user_${uid.substring(0, 5)}`;

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
             filters: 'status:pending_acceptance OR isPublic:true'
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
        return { success: true, clientSecret: paymentIntent.client_secret };
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
        gameId,
        gameDetails,
        wagerAmount,
        betType,
        betValue,
        recipientTwitterHandle,
        stripePaymentIntentId,
        isPublic,
    } = request.data;
    
    // Basic validation
    if (!gameId || !gameDetails || !wagerAmount || !betType || !betValue || !stripePaymentIntentId) {
        throw new HttpsError('invalid-argument', 'Missing required bet information.');
    }

    if (isPublic === false && !recipientTwitterHandle) {
        throw new HttpsError('invalid-argument', 'A recipient Twitter handle is required for a private challenge.');
    }
    
    if (typeof wagerAmount !== 'number' || wagerAmount <= 0) {
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
            gameId,
            gameDetails: {
                ...gameDetails,
                commence_time: Timestamp.fromDate(new Date(gameDetails.commence_time)),
            },
            challengerId: challengerId,
            recipientId: null,
            challengerUsername: userData.username,
            challengerPhotoURL: userData.photoURL,
            recipientTwitterHandle: recipientTwitterHandle ? (recipientTwitterHandle.startsWith('@') ? recipientTwitterHandle.substring(1) : recipientTwitterHandle) : null,
            wagerAmount,
            betType,
            betValue,
            status: 'pending_acceptance',
            challengerPaymentIntentId: stripePaymentIntentId,
            recipientPaymentIntentId: null,
            winnerId: null,
            createdAt: Timestamp.now(),
            settledAt: null,
            isPublic: isPublic,
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

    const { uid: recipientId } = request.auth;
    const { betId } = request.data;
    if (!betId) throw new HttpsError('invalid-argument', 'The `betId` must be provided.');
   
    const betDocRef = db.collection('bets').doc(betId);
    
    const betDoc = await betDocRef.get();
    if (!betDoc.exists) throw new HttpsError('not-found', 'Bet not found.');
    const betData = betDoc.data()!;

    // Create payment intent for the recipient
    try {
        const paymentIntent = await stripe.paymentIntents.create({
            amount: betData.wagerAmount * 100, // Stripe works in cents
            currency: 'usd',
            capture_method: 'manual', // Authorize now, capture later on confirmation
            metadata: {
                userId: recipientId,
                type: 'bet_authorization',
                betId: betId
            }
        });
        
        // This is a two-step process. First, we send the clientSecret back.
        // The client confirms the payment. A webhook will finalize the bet.
        return { success: true, clientSecret: paymentIntent.client_secret };

    } catch (error: any) {
        functions.logger.error(`Error creating recipient payment intent for bet ${betId}:`, error);
        throw new HttpsError('internal', error.message);
    }
});

export const processBetOutcomes = onCall(async (request) => {
    functions.logger.log("Starting processBetOutcomes...");
    
    const now = Timestamp.now();
    const query = db.collection('bets')
        .where('status', '==', 'active')
        .where('gameDetails.commence_time', '<=', now);
        
    const activeBetsSnap = await query.get();

    if (activeBetsSnap.empty) {
        functions.logger.log("No active bets found for processing.");
        return { success: true, message: "No bets to process." };
    }

    let processedCount = 0;

    for (const betDoc of activeBetsSnap.docs) {
        const betId = betDoc.id;
        const betData = betDoc.data() as any; // Cast as any to access dynamic properties

        try {
            const result = await sportsDataAPI.getEventResult(betData.gameDetails.sport_key, betData.gameId);

            if (result.status === 'Final') {
                let winnerId: string | null = null;
                const { home_score, away_score } = result;
                const { home_team } = betData.gameDetails;

                if (betData.betType === 'moneyline') {
                    const winningTeamName = home_score > away_score ? home_team : betData.gameDetails.away_team;
                    if (betData.betValue.team === winningTeamName) {
                        winnerId = betData.challengerId;
                    } else {
                        winnerId = betData.recipientId;
                    }
                } else if (betData.betType === 'spread') {
                    const pickedTeamIsHome = betData.betValue.team === home_team;
                    const spread = betData.betValue.points;
                    // Check for push on spread
                    if ((home_score + spread) === away_score) {
                         winnerId = null; // Push
                    } else if ((pickedTeamIsHome && (home_score + spread) > away_score) || (!pickedTeamIsHome && (away_score + spread) > home_score)) {
                         winnerId = betData.challengerId;
                    } else {
                         winnerId = betData.recipientId;
                    }
                } else if (betData.betType === 'totals') {
                    const totalScore = home_score + away_score;
                     // Check for push on totals
                    if (totalScore === betData.betValue.total) {
                        winnerId = null; // Push
                    } else if ((betData.betValue.over_under === 'over' && totalScore > betData.betValue.total) || (betData.betValue.over_under === 'under' && totalScore < betData.betValue.total)) {
                        winnerId = betData.challengerId;
                    } else {
                        winnerId = betData.recipientId;
                    }
                }
                
                if (winnerId) {
                    const loserId = winnerId === betData.challengerId ? betData.recipientId : betData.challengerId;
                    const winnerPaymentIntentId = winnerId === betData.challengerId ? betData.challengerPaymentIntentId : betData.recipientPaymentIntentId;
                    const loserPaymentIntentId = loserId === betData.challengerId ? betData.challengerPaymentIntentId : betData.recipientPaymentIntentId;

                    await stripe.paymentIntents.capture(loserPaymentIntentId);
                    await stripe.refunds.create({ payment_intent: winnerPaymentIntentId });

                    await processPayout({ 
                        betId, 
                        winnerId, 
                        stake: betData.wagerAmount, 
                        loserId,
                    });
                    await betDoc.ref.update({ status: 'completed', winnerId, settledAt: Timestamp.now() });
                    processedCount++;
                } else {
                    // This is a PUSH. We need to refund both users.
                    functions.logger.log(`Bet ${betId} resulted in a push/tie. Refunding users.`);
                    const { challengerPaymentIntentId, recipientPaymentIntentId } = betData;
                    
                    try {
                        if (challengerPaymentIntentId) await stripe.refunds.create({ payment_intent: challengerPaymentIntentId });
                        if (recipientPaymentIntentId) await stripe.refunds.create({ payment_intent: recipientPaymentIntentId });
                         functions.logger.log(`Refunds for push on bet ${betId} processed successfully.`);
                    } catch (refundError: any) {
                        functions.logger.error(`Could not issue Stripe refund for push on bet ${betId}. Manual intervention required.`, refundError.message);
                    }
                    
                    await betDoc.ref.update({ status: 'completed', settledAt: Timestamp.now(), winnerId: null });
                    processedCount++;
                }
            }
        } catch (error) {
            functions.logger.error(`Failed to process outcome for bet ${betId}:`, error);
        }
    }
    
    functions.logger.log(`Finished processBetOutcomes. Processed ${processedCount} bets.`);
    return { success: true, processedCount };
});

async function processPayout(data: { betId: string, winnerId: string, loserId: string | null, stake: number }) {
    const { betId, winnerId, loserId, stake } = data;
    const PLATFORM_COMMISSION_RATE = 0.045; // 4.5% vig
    
    const winnerDocRef = db.collection('users').doc(winnerId);
    
    const commission = stake * PLATFORM_COMMISSION_RATE;
    const payoutToWinner = stake - commission; // Winner receives the loser's stake, minus commission.

    await db.runTransaction(async (transaction) => {
        // 1. Credit winner's wallet with the payout & increment win count
        transaction.update(winnerDocRef, { 
            walletBalance: FieldValue.increment(payoutToWinner),
            wins: FieldValue.increment(1)
        });

        // 2. Increment loser's loss count
        if (loserId) {
            const loserDocRef = db.collection('users').doc(loserId);
            transaction.update(loserDocRef, { losses: FieldValue.increment(1) });
        }

        // 3. Log transactions for the payout
        const payoutTxId = db.collection('transactions').doc().id;
        transaction.set(db.collection('transactions').doc(payoutTxId), {
            userId: winnerId, type: 'bet_payout', amount: payoutToWinner, status: 'completed', relatedBetId: betId, createdAt: Timestamp.now()
        });
    });

    functions.logger.log(`Payout for bet ${betId} processed for winner ${winnerId}.`);
}

export const ingestUpcomingGames = onCall(async (request) => {
    functions.logger.log("Starting to ingest upcoming games from The Odds API.");
    const apiKey = process.env.ODDS_API_KEY;

    if (!apiKey) {
        throw new HttpsError('internal', 'The an API key is not configured.');
    }

    try {
        const sportsUrl = `https://api.the-odds-api.com/v4/sports?apiKey=${apiKey}`;
        const sportsResponse = await fetch(sportsUrl);
        if(!sportsResponse.ok) {
            throw new HttpsError('internal', `Failed to fetch sports list. Status: ${sportsResponse.status}`);
        }
        const sports: {key: string, title: string}[] = await sportsResponse.json();
        
        const batch = db.batch();
        let gamesIngested = 0;

        for (const sport of sports) {
             if (!sport.key.includes('_nfl') && !sport.key.includes('_nba') && !sport.key.includes('_mlb')) continue;

            const eventsUrl = `https://api.the-odds-api.com/v4/sports/${sport.key}/events?apiKey=${apiKey}`;
            const eventsResponse = await fetch(eventsUrl);
            if (!eventsResponse.ok) {
                 functions.logger.warn(`Could not fetch events for sport ${sport.key}. Status: ${eventsResponse.status}`);
                 continue;
            }
            const events:any = await eventsResponse.json();

            for (const event of events) {
                const gameRef = db.collection('games').doc(event.id);
                 const gameDoc = {
                    id: event.id,
                    sport_key: event.sport_key,
                    sport_title: event.sport_title,
                    commence_time: Timestamp.fromDate(new Date(event.commence_time)),
                    home_team: event.home_team,
                    away_team: event.away_team,
                    is_complete: false,
                    last_update: Timestamp.now()
                };
                batch.set(gameRef, gameDoc, { merge: true });
                gamesIngested++;
            }
        }


        await batch.commit();
        functions.logger.log(`Successfully ingested/updated ${gamesIngested} games.`);
        return { success: true, gamesIngested };

    } catch (error) {
        functions.logger.error("Error ingesting upcoming games:", error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', 'An internal error occurred during game ingestion.');
    }
});


export const updateOddsAndScores = onCall(async (request) => {
    functions.logger.log("Starting to update odds and scores.");
    const apiKey = process.env.ODDS_API_KEY;

    if (!apiKey || apiKey === '9506477182d2f2335317a695b5e875e4') {
        throw new HttpsError('internal', 'ODDS_API_KEY is not configured.');
    }

    const now = new Date();
    const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
    const fortyEightHoursFromNow = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    const gamesQuery = db.collection('games')
        .where('is_complete', '!=', true)
        .where('commence_time', '>=', Timestamp.fromDate(sixHoursAgo))
        .where('commence_time', '<=', Timestamp.fromDate(fortyEightHoursFromNow));

    const gamesSnapshot = await gamesQuery.get();
    if (gamesSnapshot.empty) {
        functions.logger.log("No relevant games found to update.");
        return { success: true, message: "No games to update." };
    }

    const gamesBySport = gamesSnapshot.docs.reduce((acc, doc) => {
        const game = doc.data();
        const sportKey = game.sport_key;
        if (!acc[sportKey]) {
            acc[sportKey] = [];
        }
        acc[sportKey].push(game);
        return acc;
    }, {} as Record<string, any[]>);

    let updatedOddsCount = 0;
    let updatedScoresCount = 0;

    for (const sportKey in gamesBySport) {
        try {
            const oddsUrl = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds/?regions=us&markets=h2h,spreads,totals&oddsFormat=american&apiKey=${apiKey}`;
            const oddsResponse = await fetch(oddsUrl);
            if (!oddsResponse.ok) {
                functions.logger.error(`Failed to fetch odds for ${sportKey}:`, await oddsResponse.text());
                continue;
            }
            const oddsData:any = await oddsResponse.json();
            const batch = db.batch();

            for (const gameOdds of oddsData) {
                if (!gameOdds.bookmakers) continue;
                for (const bookmaker of gameOdds.bookmakers) {
                    const oddsRef = db.collection('games').doc(gameOdds.id).collection('bookmaker_odds').doc(bookmaker.key);
                    batch.set(oddsRef, { ...bookmaker, last_update: Timestamp.now() });
                    updatedOddsCount++;
                }
            }
            await batch.commit();
            functions.logger.log(`Successfully updated odds for ${sportKey}.`);
        } catch (error) {
            functions.logger.error(`Error processing odds for ${sportKey}:`, error);
        }
        
        try {
            const scoresUrl = `https://api.the-odds-api.com/v4/sports/${sportKey}/scores/?apiKey=${apiKey}`;
            const scoresResponse = await fetch(scoresUrl);
            if (!scoresResponse.ok) {
                functions.logger.error(`Failed to fetch scores for ${sportKey}:`, await scoresResponse.text());
                continue;
            }
            const scoresData:any = await scoresResponse.json();
            const batch = db.batch();

            for (const gameScore of scoresData) {
                if (gameScore.completed) {
                    const gameRef = db.collection('games').doc(gameScore.id);
                    const homeScore = gameScore.scores?.find((s:any) => s.name === gameScore.home_team)?.score || null;
                    const awayScore = gameScore.scores?.find((s:any) => s.name === gameScore.away_team)?.score || null;
                    
                    batch.update(gameRef, {
                        home_score: homeScore,
                        away_score: awayScore,
                        is_complete: true,
                        last_update: Timestamp.now()
                    });
                    updatedScoresCount++;
                }
            }
            await batch.commit();
            functions.logger.log(`Successfully updated scores for ${sportKey}.`);
        } catch (error) {
            functions.logger.error(`Error processing scores for ${sportKey}:`, error);
        }
    }
    
    functions.logger.log(`Finished update cycle. Updated odds for ${updatedOddsCount} bookmakers and scores for ${updatedScoresCount} games.`);
    return { success: true, updatedOddsCount, updatedScoresCount };
});

export const generateBetImage = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'You must be logged in to generate a bet image.');
    }

    try {
        const result = await generateBetImage(request.data);
        return result;
    } catch(e: any) {
        functions.logger.error('Error generating bet image', e);
        throw new HttpsError('internal', 'There was an error generating the bet image.');
    }
});
    
// This is our secure, callable function named 'getUpcomingOdds'
export const getUpcomingOdds = onCall(async (request) => {
  // Your secret API key is stored securely in environment variables, not in the code.
  // We set this up in a previous step.
  const apiKey = process.env.ODDS_API_KEY;

  const sportKey = 'upcoming';
  const regions = 'us';
  const markets = 'h2h';
  const oddsFormat = 'american';
  const dateFormat = 'iso';

  const apiUrl = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds?apiKey=${apiKey}&regions=${regions}&markets=${markets}&oddsFormat=${oddsFormat}&dateFormat=${dateFormat}`;

  functions.logger.info("Fetching odds from:", apiUrl);

  try {
    const response = await fetch(apiUrl);

    if (!response.ok) {
      const errorData = await response.text();
      functions.logger.error(`Failed to get odds: status_code ${response.status}, response body ${errorData}`);
      // Throw an error that the frontend can understand
      throw new HttpsError('internal', 'Failed to fetch odds.');
    }

    const oddsData = await response.json();
    functions.logger.info("Successfully fetched odds data.");
    
    // Return the data to the frontend that called this function
    return oddsData;

  } catch (error) {
    functions.logger.error('Error fetching odds data:', error);
    // Throw an error that the frontend can understand
    throw new HttpsError('unknown', 'An unknown error occurred.');
  }
});


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

    // Handle the event
    switch (event.type) {
        case 'payment_intent.succeeded':
            const piSucceeded = event.data.object as Stripe.PaymentIntent;
            if (piSucceeded.metadata.type === 'wallet_deposit') {
                functions.logger.info(`Processing successful wallet deposit for user ${piSucceeded.metadata.userId}`);
                const amount = piSucceeded.amount_received / 100; // convert back from cents
                
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
            // Optionally, notify the user about the payment failure.
            break;

        case 'payment_intent.requires_capture':
            const piToCapture = event.data.object as Stripe.PaymentIntent;
            const { userId: recipientId, betId } = piToCapture.metadata;
            if (betId && recipientId) {
                functions.logger.info(`Finalizing bet ${betId} after recipient ${recipientId} authorized payment.`);
                
                const betDocRef = db.collection('bets').doc(betId);
                const recipientDocRef = db.collection('users').doc(recipientId);

                await db.runTransaction(async (transaction) => {
                    const betDoc = await transaction.get(betDocRef);
                    const recipientDoc = await transaction.get(recipientDocRef);
                    
                    if (!betDoc.exists) throw new Error(`Bet ${betId} not found.`);
                    if (!recipientDoc.exists) throw new Error(`Recipient ${recipientId} not found.`);

                    const betData = betDoc.data()!;
                    const recipientData = recipientDoc.data()!;
                    const { challengerId, status, recipientTwitterHandle } = betData;

                    if (status !== 'pending_acceptance') throw new Error(`Bet ${betId} is not pending acceptance.`);
                    if (challengerId === recipientId) throw new Error('User cannot accept their own bet.');
                    
                    if(recipientTwitterHandle && recipientData.username.toLowerCase() !== recipientTwitterHandle.toLowerCase()) {
                        throw new Error('User is not the intended recipient.');
                    }
                    
                    if (recipientData.kycStatus !== 'verified') throw new Error('Recipient must be KYC verified.');

                    // Capture both payments
                    await stripe.paymentIntents.capture(betData.challengerPaymentIntentId);
                    await stripe.paymentIntents.capture(piToCapture.id);

                    // Update Bet Document
                    transaction.update(betDocRef, {
                        recipientId: recipientId,
                        status: 'active',
                        recipientUsername: recipientData.username,
                        recipientPhotoURL: recipientData.photoURL,
                        recipientPaymentIntentId: piToCapture.id,
                    });
                });
                functions.logger.log(`Bet ${betId} successfully activated.`);
            }
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
