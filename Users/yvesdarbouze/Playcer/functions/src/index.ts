
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

    const { uid: creatorId } = request.auth;
    const {
        eventId,
        eventDate,
        homeTeam,
        awayTeam,
        betType,
        stakeAmount,
        chosenOption,
        isPublic,
        twitterShareUrl,
    } = request.data;
    
    // Basic validation
    if (!eventId || !eventDate || !homeTeam || !awayTeam || !betType || !chosenOption || !stakeAmount) {
        throw new HttpsError('invalid-argument', 'Missing required bet information.');
    }

    if (isPublic === false && !twitterShareUrl) {
        throw new HttpsError('invalid-argument', 'A twitter handle is required for a private challenge.');
    }
    
    if (typeof stakeAmount !== 'number' || stakeAmount <= 0) {
        throw new HttpsError('invalid-argument', 'The wager amount must be a positive number.');
    }

    const userDocRef = db.collection('users').doc(creatorId);
    
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
            creatorId: creatorId,
            takerId: null,
            creatorUsername: userData.username,
            creatorPhotoURL: userData.photoURL,
            takerUsername: null,
            takerPhotoURL: null,
            stakeAmount,
            betType,
            chosenOption,
            status: 'pending',
            isPublic: isPublic,
            twitterShareUrl: twitterShareUrl || null,
            winnerId: null,
            loserId: null,
            createdAt: Timestamp.now(),
            settledAt: null,
            outcome: null,
        };

        const betDocRef = db.collection('bets').doc(betId);
        transaction.set(betDocRef, newBet);
        
        functions.logger.log(`Bet ${betId} created by user ${creatorId}`);
        return { success: true, betId };
    });
});


export const acceptBet = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'You must be logged in to accept a bet.');
    }

    const { uid: takerId } = request.auth;
    const { betId } = request.data;
    if (!betId) throw new HttpsError('invalid-argument', 'The `betId` must be provided.');
   
    const betDocRef = db.collection('bets').doc(betId);
    
    const betDoc = await betDocRef.get();
    if (!betDoc.exists) throw new HttpsError('not-found', 'Bet not found.');
    const betData = betDoc.data()!;

    // Create payment intent for the recipient
    try {
        const paymentIntent = await stripe.paymentIntents.create({
            amount: betData.stakeAmount * 100, // Stripe works in cents
            currency: 'usd',
            capture_method: 'manual', // Authorize now, capture later on confirmation
            metadata: {
                userId: takerId,
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
        .where('status', '==', 'accepted')
        .where('eventDate', '<=', now);
        
    const activeBetsSnap = await query.get();

    if (activeBetsSnap.empty) {
        functions.logger.log("No active bets found for processing.");
        return { success: true, message: "No bets to process." };
    }

    let processedCount = 0;

    for (const betDoc of activeBetsSnap.docs) {
        const betId = betDoc.id;
        const betData = betDoc.data() as any; 

        try {
            const result = await sportsDataAPI.getEventResult(betData.sportKey, betData.eventId);

            if (result.status === 'Final') {
                let winnerId: string | null = null;
                const { home_score, away_score } = result;
                const { homeTeam } = betData;

                if (betData.betType === 'moneyline') {
                    const winningTeamName = home_score > away_score ? homeTeam : betData.awayTeam;
                    if (betData.chosenOption === winningTeamName) {
                        winnerId = betData.creatorId;
                    } else {
                        winnerId = betData.takerId;
                    }
                } 
                
                if (winnerId) {
                    const loserId = winnerId === betData.creatorId ? betData.takerId : betData.creatorId;
                    await processPayout({ 
                        betId, 
                        winnerId, 
                        stake: betData.stakeAmount, 
                        loserId,
                    });
                    await betDoc.ref.update({ status: 'resolved', winnerId, loserId, outcome: 'win', settledAt: Timestamp.now() });
                    processedCount++;
                } else {
                     await processPayout({ 
                        betId, 
                        winnerId: null, 
                        stake: betData.stakeAmount, 
                        loserId: null,
                    });
                    await betDoc.ref.update({ status: 'resolved', outcome: 'draw', settledAt: Timestamp.now() });
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

async function processPayout(data: { betId: string, winnerId: string | null, loserId: string | null, stake: number }) {
    const { betId, winnerId, loserId, stake } = data;
    const PLATFORM_COMMISSION_RATE = 0.045; // 4.5% vig
    
    await db.runTransaction(async (transaction) => {
        if(winnerId && loserId) {
            const winnerDocRef = db.collection('users').doc(winnerId);
            const loserDocRef = db.collection('users').doc(loserId);
            const commission = stake * PLATFORM_COMMISSION_RATE;
            const payoutToWinner = stake - commission; 

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
        } else {
            // This is a PUSH. Refund both users.
            const betDoc = await transaction.get(db.collection('bets').doc(betId));
            const betData = betDoc.data()!;
            const creatorDocRef = db.collection('users').doc(betData.creatorId);
            const takerDocRef = db.collection('users').doc(betData.takerId);
            transaction.update(creatorDocRef, { walletBalance: FieldValue.increment(stake), totalBets: FieldValue.increment(1) });
            transaction.update(takerDocRef, { walletBalance: FieldValue.increment(stake), totalBets: FieldValue.increment(1) });
        }
    });

    functions.logger.log(`Payout for bet ${betId} processed.`);
}

export const ingestUpcomingGames = onCall(async (request) => {
    functions.logger.log("Starting to ingest upcoming games from RapidAPI Sportsbook API.");
    const apiKey = process.env.RAPIDAPI_KEY;

    if (!apiKey) {
        throw new HttpsError('internal', 'The RapidAPI key is not configured.');
    }
    
    const competitionKeys = {
        'americanfootball_nfl': 'd791-wddv-30fU',
        'americanfootball_ncaaf': 'gA4y-wddv-HEn4',
        'americanfootball_cfl': '38fU-wddv-9r4y',
        'americanfootball_usfl': '38fU-wddv-9r4y', // USFL might share with CFL or have its own, using placeholder
        'baseball_mlb': 'H2nG-wddv-NZsP',
        'baseball_npb': 'H2nG-wddv-NZsP', // NPB might share with MLB or have its own, using placeholder
        'baseball_kbo': 'H2nG-wddv-NZsP', // KBO might share with MLB or have its own, using placeholder
        'basketball_nba': 'd791-wddv-30fU',
        'basketball_ncaab': 'gA4y-wddv-HEn4',
        'basketball_wnba': 'd791-wddv-30fU', // WNBA might share with NBA or have its own
        'basketball_nbl_australia': 'd791-wddv-30fU', // NBL Australia might share with NBA
        'soccer_epl': 'H2nG-wddv-NZsP',
        'soccer_efl_championship': 'H2nG-wddv-NZsP',
        'soccer_la_liga': 'H2nG-wddv-NZsP',
        'soccer_bundesliga': 'H2nG-wddv-NZsP',
        'soccer_serie_a': 'H2nG-wddv-NZsP',
        'soccer_ligue_one': 'H2nG-wddv-NZsP',
        'soccer_mls': 'H2nG-wddv-NZsP',
        'soccer_nwsl': 'H2nG-wddv-NZsP',
        'icehockey_nhl': '56N0-wddv-9VqL',
        'icehockey_shl': '56N0-wddv-9VqL', // SHL might share with NHL
        'icehockey_sm_liiga': '56N0-wddv-9VqL', // SM-liiga might share with NHL
        'aussierules_afl': '38fU-wddv-9r4y',
        'lacrosse_nll': '38fU-wddv-9r4y',
        'lacrosse_pll': '38fU-wddv-9r4y',
        'handball_lnh_division_1': 'gA4y-wddv-HEn4',
    };

    const options = {
        method: 'GET',
        headers: {
            'x-rapidapi-key': apiKey,
            'x-rapidapi-host': 'sportsbook-api2.p.rapidapi.com'
        }
    };

    let allEvents: any[] = [];

    // Step 1: Fetch events for each competition
    for (const [sport, competitionKey] of Object.entries(competitionKeys)) {
        const eventsUrl = `https://sportsbook-api2.p.rapidapi.com/v0/competitions/${competitionKey}/events`;
        try {
            const response = await fetch(eventsUrl, options);
            if (!response.ok) {
                functions.logger.error(`Failed to fetch events for ${sport}. Status: ${response.status}`);
                continue;
            }
            const data: any = await response.json();
            if (data?.events) {
                // Add sport key to each event for later reference
                const eventsWithSportKey = data.events.map((e: any) => ({ ...e, sport_key: sport }));
                allEvents = [...allEvents, ...eventsWithSportKey];
            }
        } catch (error) {
            functions.logger.error(`Error fetching events for ${sport}:`, error);
        }
    }

    if (allEvents.length === 0) {
        functions.logger.log("No upcoming events found from RapidAPI.");
        return { success: true, gamesIngested: 0, oddsIngested: 0 };
    }

    // Step 2: Batch fetch detailed event odds
    const eventKeys = allEvents.map(e => e.key);
    const batchSize = 50;
    let oddsIngested = 0;
    
    for (let i = 0; i < eventKeys.length; i += batchSize) {
        const batchKeys = eventKeys.slice(i, i + batchSize);
        const eventKeysQuery = batchKeys.map(key => `eventKeys=${key}`).join('&');
        const oddsUrl = `https://sportsbook-api2.p.rapidapi.com/v0/events?${eventKeysQuery}`;

        try {
            const response = await fetch(oddsUrl, options);
             if (!response.ok) {
                const errorBody = await response.text();
                functions.logger.error(`Failed to fetch event details. Status: ${response.status}, Body: ${errorBody}`);
                continue;
            }
            const data: any = await response.json();
            const detailedEvents = data?.events;

            if (!detailedEvents || detailedEvents.length === 0) continue;

            const batch = db.batch();
            for (const event of detailedEvents) {
                const originalEvent = allEvents.find(e => e.key === event.key);
                if (!originalEvent) continue;

                const homeParticipant = event.participants.find((p: any) => p.key === event.homeParticipantKey);
                const awayParticipant = event.participants.find((p: any) => p.key !== event.homeParticipantKey);
                
                if (!homeParticipant || !awayParticipant) continue;
                
                const gameRef = db.collection('games').doc(event.key);
                const gameDoc = {
                    id: event.key,
                    sport_key: originalEvent.sport_key,
                    sport_title: homeParticipant.sport,
                    commence_time: Timestamp.fromDate(new Date(event.startTime)),
                    home_team: homeParticipant.name,
                    away_team: awayParticipant.name,
                    is_complete: false,
                    last_update: Timestamp.now()
                };
                batch.set(gameRef, gameDoc, { merge: true });

                // Ingest odds into a subcollection
                if (event.markets) {
                    for (const market of event.markets) {
                        for (const [bookmaker, outcomes] of Object.entries(market.outcomes)) {
                             const oddsRef = db.collection('games').doc(event.key).collection('bookmaker_odds').doc(bookmaker);
                             const bookmakerOdds = {
                                 key: bookmaker,
                                 title: bookmaker,
                                 last_update: Timestamp.now(),
                                 markets: [market] // Storing the whole market object for simplicity
                             };
                             batch.set(oddsRef, bookmakerOdds, { merge: true });
                             oddsIngested++;
                        }
                    }
                }
            }
            await batch.commit();

        } catch(error) {
            functions.logger.error(`Error fetching or processing batch ${i/batchSize + 1}:`, error);
        }
    }
    
    functions.logger.log(`Successfully ingested/updated ${allEvents.length} games and ${oddsIngested} odds from RapidAPI.`);
    return { success: true, gamesIngested: allEvents.length, oddsIngested };
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
    
export const getUpcomingOdds = onCall(async (request) => {
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
      throw new HttpsError('internal', 'Failed to fetch odds.');
    }

    const oddsData = await response.json();
    functions.logger.info("Successfully fetched odds data.");
    
    return oddsData;

  } catch (error) {
    functions.logger.error('Error fetching odds data:', error);
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
            break;

        case 'payment_intent.requires_capture':
            const piToCapture = event.data.object as Stripe.PaymentIntent;
            const { userId: takerId, betId } = piToCapture.metadata;
            if (betId && takerId) {
                functions.logger.info(`Finalizing bet ${betId} after taker ${takerId} authorized payment.`);
                
                const betDocRef = db.collection('bets').doc(betId);
                const takerDocRef = db.collection('users').doc(takerId);

                await db.runTransaction(async (transaction) => {
                    const betDoc = await transaction.get(betDocRef);
                    const takerDoc = await transaction.get(takerDocRef);
                    
                    if (!betDoc.exists) throw new Error(`Bet ${betId} not found.`);
                    if (!takerDoc.exists) throw new Error(`Taker ${takerId} not found.`);

                    const betData = betDoc.data()!;
                    const takerData = takerDoc.data()!;
                    const { creatorId, status } = betData;

                    if (status !== 'pending') throw new Error(`Bet ${betId} is not pending acceptance.`);
                    if (creatorId === takerId) throw new Error('User cannot accept their own bet.');
                    
                    if (takerData.kycStatus !== 'verified') throw new Error('Recipient must be KYC verified.');

                    await stripe.paymentIntents.capture(piToCapture.id);

                    transaction.update(betDocRef, {
                        takerId: takerId,
                        status: 'accepted',
                        takerUsername: takerData.username,
                        takerPhotoURL: takerData.photoURL,
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

export const getArbitrageOpportunities = onCall(async (request) => {
    const apiKey = process.env.RAPIDAPI_KEY;

    if (!apiKey) {
        throw new HttpsError('internal', 'The RapidAPI key is not configured.');
    }

    const options = {
        method: 'GET',
        headers: {
            'x-rapidapi-key': apiKey,
            'x-rapidapi-host': 'sportsbook-api2.p.rapidapi.com'
        }
    };
    
    const url = 'https://sportsbook-api2.p.rapidapi.com/v1/advantages/';

    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            const errorBody = await response.text();
            functions.logger.error(`Failed to fetch arbitrage opportunities. Status: ${response.status}, Body: ${errorBody}`);
            throw new HttpsError('internal', 'Failed to fetch arbitrage data from the provider.');
        }
        const data = await response.json();
        return data;
    } catch (error) {
        functions.logger.error('Error fetching arbitrage opportunities:', error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('unknown', 'An unknown error occurred while fetching arbitrage opportunities.');
    }
});
    

    

    
