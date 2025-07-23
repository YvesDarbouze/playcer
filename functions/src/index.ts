

import {initializeApp} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import {getFirestore, Timestamp, FieldValue} from "firebase-admin/firestore";
import {onUserCreate} from "firebase-functions/v2/auth";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import {logger} from "firebase-functions";
import { v4 as uuidv4 } from "uuid";
import * as algoliasearch from 'algoliasearch';

// Initialize Algolia client
// Ensure you have set these environment variables in your Firebase project configuration
const algoliaClient = algoliasearch.default(process.env.ALGOLIA_APP_ID!, process.env.ALGOLIA_API_KEY!);


// Initialize Firebase Admin SDK
initializeApp();
const db = getFirestore();
const auth = getAuth();


// --- PLACEHOLDER THIRD-PARTY SERVICES ---
// In a real application, these would interact with external APIs.

const paymentGateway = {
    // This function simulates creating a payment intent (e.g., with Stripe).
    // It returns a client secret that the frontend would use to confirm the payment.
    async createPaymentIntent(userId: string, amount: number): Promise<{success: boolean, clientSecret: string, transactionId: string}> {
        logger.log(`Creating payment intent for user ${userId} of amount ${amount}.`);
        // In a real app, you'd call Stripe's API here.
        // The clientSecret would be returned from Stripe.
        return { success: true, clientSecret: `pi_${uuidv4()}_secret_${uuidv4()}`, transactionId: `deposit_${uuidv4()}` };
    },
    // This would be triggered by a webhook from the payment provider (e.g., Stripe)
    // after the user successfully completes the payment on the frontend.
    // We are not building the webhook endpoint in this step, but simulating its effect.
    async processSuccessfulPayment(transactionId: string, amount: number, userId: string) {
        logger.log(`Processing successful payment for transaction ${transactionId}`);
        const userDocRef = db.collection('users').doc(userId);
        await db.runTransaction(async (transaction) => {
            transaction.update(userDocRef, { walletBalance: FieldValue.increment(amount) });
            const transactionDocRef = db.collection('transactions').doc(transactionId);
             transaction.set(transactionDocRef, {
                userId: userId,
                type: 'deposit',
                amount: amount,
                status: 'completed',
                gatewayTransactionId: transactionId,
                createdAt: Timestamp.now(),
            });
        });
        logger.log(`Wallet balance updated for user ${userId}.`);
    }
};

const escrowService = {
    async lockFunds(betId: string, amount: number): Promise<{success: boolean, escrowId: string}> {
        logger.log(`Locking funds for bet ${betId} of amount ${amount} in escrow.`);
        // In a real app, this would call a dedicated escrow provider API.
        return { success: true, escrowId: `escrow_${uuidv4()}`};
    },
    async releaseFunds(escrowId: string, winnerId: string): Promise<{success: boolean}> {
        logger.log(`Releasing funds from escrow ${escrowId} to winner ${winnerId}.`);
        // In a real app, this would call the escrow provider to disburse funds.
        return { success: true };
    },
    async refundFunds(escrowId: string, partyIds: string[]): Promise<{success: boolean}> {
        logger.log(`Refunding funds from escrow ${escrowId} to parties ${partyIds.join(', ')}.`);
        // In a real app, this would call the escrow provider to return funds to both parties.
        return { success: true };
    }
}

const sportsDataAPI = {
     async getEventResult(sportKey: string, eventId: string): Promise<{ home_score: number, away_score: number, status: 'Final' | 'InProgress' }> {
        logger.log(`Fetching result for event ${eventId} from sports data oracle.`);
        const apiKey = process.env.ODDS_API_KEY;

        if (!apiKey || apiKey === '9506477182d2f2335317a695b5e875e4') {
            logger.error(`CRITICAL: ODDS_API_KEY is not set. Aborting event result fetch for event ${eventId}.`);
            // Throw an error to prevent using mock data in a live environment.
            throw new Error('Sports data API key is not configured.');
        }

        try {
            const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/scores/?daysFrom=3&apiKey=${apiKey}&eventIds=${eventId}`;
            const response = await fetch(url);

            if (!response.ok) {
                logger.error(`Error fetching event result from TheOddsAPI for event ${eventId}. Status: ${response.status}`);
                throw new Error('Failed to fetch from TheOddsAPI');
            }

            const data = await response.json();
            const eventResult = data[0];

            if (!eventResult || !eventResult.completed) {
                return { home_score: 0, away_score: 0, status: 'InProgress' };
            }

            const homeScore = parseInt(eventResult.scores.find((s: any) => s.name === eventResult.home_team)?.score || '0');
            const awayScore = parseInt(eventResult.scores.find((s: any) => s.name === eventResult.away_team)?.score || '0');

            return { home_score: homeScore, away_score: awayScore, status: 'Final' };

        } catch (error) {
            logger.error(`Exception fetching event result for ${eventId}:`, error);
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
      kycStatus: "verified", // Auto-verified for demo purposes
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
    logger.log("User document created successfully for UID:", uid);
  } catch (error) {
    logger.error("Error creating user document for UID:", uid, error);
  }
});


// --- HTTP CALLABLE FUNCTIONS ---

export const getAlgoliaSearchKey = onCall((request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'You must be logged in to search.');
    }
    
    const searchKey = algoliaClient.generateSecuredApiKey(
        process.env.ALGOLIA_SEARCH_ONLY_API_KEY!,
        {
             filters: 'status:pending_acceptance'
        }
    );

    return { key: searchKey };
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
        const intentResult = await paymentGateway.createPaymentIntent(uid, depositAmount);
        if (!intentResult.success) {
            throw new HttpsError('aborted', 'Payment intent creation failed.');
        }
        await paymentGateway.processSuccessfulPayment(intentResult.transactionId, depositAmount, uid);
        logger.log(`Successfully processed deposit simulation for user ${uid}.`);
        return { success: true, message: 'Deposit successful.' };

    } catch (error) {
        logger.error(`Error handling deposit for user ${uid}:`, error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', 'An internal error occurred while processing your deposit.');
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
    } = request.data;
    
    // Basic validation
    if (!gameId || !gameDetails || !wagerAmount || !betType || !betValue || !recipientTwitterHandle) {
        throw new HttpsError('invalid-argument', 'Missing required bet information.');
    }
    
    if (typeof wagerAmount !== 'number' || wagerAmount <= 0) {
        throw new HttpsError('invalid-argument', 'The wager amount must be a positive number.');
    }

    const userDocRef = db.collection('users').doc(challengerId);
    const userDoc = await userDocRef.get();
    if (!userDoc.exists) {
        throw new HttpsError('not-found', 'User profile not found.');
    }
    const userData = userDoc.data()!;

    if (userData.kycStatus !== 'verified') {
        throw new HttpsError('failed-precondition', 'You must verify your identity to create a bet.');
    }
    if (userData.walletBalance < wagerAmount) {
        throw new HttpsError('failed-precondition', 'Insufficient wallet balance to create this bet.');
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
        challengerTwitterHandle: userData.username,
        recipientTwitterHandle: recipientTwitterHandle.startsWith('@') ? recipientTwitterHandle.substring(1) : recipientTwitterHandle,
        wagerAmount,
        betType,
        betValue,
        status: 'pending_acceptance',
        stripePaymentIntentId: null,
        winnerId: null,
        createdAt: Timestamp.now(),
        settledAt: null,

        // Denormalized data for display purposes
        creatorUsername: userData.username,
        creatorPhotoURL: userData.photoURL,
    };

    const betDocRef = db.collection('bets').doc(betId);
    await betDocRef.set(newBet);
    
    logger.log(`Bet ${betId} created by user ${challengerId}`);
    return { success: true, betId };
});


export const matchBet = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'You must be logged in to accept a bet.');
    }

    const { uid: recipientId } = request.auth;
    const { betId } = request.data;
    if (!betId) throw new HttpsError('invalid-argument', 'The `betId` must be provided.');

    const betDocRef = db.collection('bets').doc(betId);
    const recipientDocRef = db.collection('users').doc(recipientId);
    
    await db.runTransaction(async (transaction) => {
        const betDoc = await transaction.get(betDocRef);
        const recipientDoc = await transaction.get(recipientDocRef);
        
        if (!betDoc.exists) throw new HttpsError('not-found', 'Bet not found.');
        if (!recipientDoc.exists) throw new HttpsError('not-found', 'Recipient profile not found.');

        const betData = betDoc.data()!;
        const recipientData = recipientDoc.data()!;
        const { challengerId, wagerAmount, status } = betData;

        if (challengerId === recipientId) throw new HttpsError('failed-precondition', 'You cannot accept your own bet.');
        if (status !== 'pending_acceptance') throw new HttpsError('failed-precondition', 'This bet is no longer open for acceptance.');
        if (recipientData.kycStatus !== 'verified') throw new HttpsError('failed-precondition', 'You must complete identity verification to accept a bet.');
        if (recipientData.walletBalance < wagerAmount) throw new HttpsError('failed-precondition', 'You have insufficient funds to accept this bet.');

        const challengerDocRef = db.collection('users').doc(challengerId);
        const creatorDoc = await transaction.get(challengerDocRef);
        if (!creatorDoc.exists) throw new HttpsError('not-found', 'Challenger profile not found.');

        const creatorData = creatorDoc.data()!;
        if (creatorData.walletBalance < wagerAmount) throw new HttpsError('failed-precondition', 'The challenger has insufficient funds.');

        // Update Bet Document
        transaction.update(betDocRef, {
            recipientId: recipientId,
            status: 'active',
            recipientUsername: recipientData.username,
            recipientPhotoURL: recipientData.photoURL,
        });
    });
    
    logger.log(`Bet ${betId} successfully matched by ${recipientId}.`);
    return { success: true, message: "Bet accepted and matched!" };
});

export const processBetOutcomes = onCall(async (request) => {
    logger.log("Starting processBetOutcomes...");
    
    const now = Timestamp.now();
    const query = db.collection('bets')
        .where('status', '==', 'active')
        .where('gameDetails.commence_time', '<=', now);
        
    const activeBetsSnap = await query.get();

    if (activeBetsSnap.empty) {
        logger.log("No active bets found for processing.");
        return { success: true, message: "No bets to process." };
    }

    let processedCount = 0;

    for (const betDoc of activeBetsSnap.docs) {
        const betId = betDoc.id;
        const betData = betDoc.data() as any; // Cast as any to access dynamic properties

        try {
            const result = await sportsDataAPI.getEventResult(betData.sportKey, betData.gameId);

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
                    if ((pickedTeamIsHome && (home_score + spread) > away_score) || (!pickedTeamIsHome && (away_score + spread) > home_score)) {
                         winnerId = betData.challengerId;
                    } else {
                         winnerId = betData.recipientId;
                    }
                } else if (betData.betType === 'totals') {
                    const totalScore = home_score + away_score;
                    if ((betData.betValue.over_under === 'over' && totalScore > betData.betValue.total) || (betData.betValue.over_under === 'under' && totalScore < betData.betValue.total)) {
                        winnerId = betData.challengerId;
                    } else {
                        winnerId = betData.recipientId;
                    }
                }
                
                if (winnerId) {
                    await processPayout({ 
                        betId, 
                        winnerId, 
                        stake: betData.wagerAmount, 
                        loserId: winnerId === betData.challengerId ? betData.recipientId : betData.challengerId,
                    });
                    await betDoc.ref.update({ status: 'completed', winnerId, settledAt: Timestamp.now() });
                    processedCount++;
                } else {
                    await betDoc.ref.update({ status: 'completed', settledAt: Timestamp.now() }); // Push/Tie
                    logger.log(`Bet ${betId} resulted in a push/void.`);
                }
            }
        } catch (error) {
            logger.error(`Failed to process outcome for bet ${betId}:`, error);
        }
    }
    
    logger.log(`Finished processBetOutcomes. Processed ${processedCount} bets.`);
    return { success: true, processedCount };
});

async function processPayout(data: { betId: string, winnerId: string, loserId: string | null, stake: number }) {
    const { betId, winnerId, loserId, stake } = data;
    const PLATFORM_COMMISSION_RATE = 0.045; // 4.5% vig
    
    const winnerDocRef = db.collection('users').doc(winnerId);
    const loserDocRef = loserId ? db.collection('users').doc(loserId) : null;
    
    const commission = stake * PLATFORM_COMMISSION_RATE;
    const payoutAmount = stake * 2 - commission; // Winner gets the full pot minus commission

    await db.runTransaction(async (transaction) => {
        // 1. Debit both users' wallets for the stake
        if (loserDocRef) {
            transaction.update(loserDocRef, { walletBalance: FieldValue.increment(-stake), losses: FieldValue.increment(1) });
        }
        transaction.update(winnerDocRef, { walletBalance: FieldValue.increment(-stake) });


        // 2. Credit winner's wallet with the full pot & increment win count
        transaction.update(winnerDocRef, { 
            walletBalance: FieldValue.increment(stake * 2 - commission),
            wins: FieldValue.increment(1)
        });

        // 3. Log transactions
        const winnerTxId = db.collection('transactions').doc().id;
        transaction.set(db.collection('transactions').doc(winnerTxId), {
            userId: winnerId, type: 'bet_payout', amount: stake - commission, status: 'completed', relatedBetId: betId, createdAt: Timestamp.now()
        });

        if (loserId) {
            const loserTxId = db.collection('transactions').doc().id;
            transaction.set(db.collection('transactions').doc(loserTxId), {
                userId: loserId, type: 'bet_stake', amount: -stake, status: 'completed', relatedBetId: betId, createdAt: Timestamp.now()
            });
        }
    });

    logger.log(`Payout for bet ${betId} processed for winner ${winnerId}.`);
}

export const ingestUpcomingGames = onCall(async (request) => {
    logger.log("Starting to ingest upcoming games from The Odds API.");
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
                 logger.warn(`Could not fetch events for sport ${sport.key}. Status: ${eventsResponse.status}`);
                 continue;
            }
            const events = await eventsResponse.json();

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
        logger.log(`Successfully ingested/updated ${gamesIngested} games.`);
        return { success: true, gamesIngested };

    } catch (error) {
        logger.error("Error ingesting upcoming games:", error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', 'An internal error occurred during game ingestion.');
    }
});


export const updateOddsAndScores = onCall(async (request) => {
    logger.log("Starting to update odds and scores.");
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
        logger.log("No relevant games found to update.");
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
                logger.error(`Failed to fetch odds for ${sportKey}:`, await oddsResponse.text());
                continue;
            }
            const oddsData = await oddsResponse.json();
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
            logger.log(`Successfully updated odds for ${sportKey}.`);
        } catch (error) {
            logger.error(`Error processing odds for ${sportKey}:`, error);
        }
        
        try {
            const scoresUrl = `https://api.the-odds-api.com/v4/sports/${sportKey}/scores/?apiKey=${apiKey}`;
            const scoresResponse = await fetch(scoresUrl);
            if (!scoresResponse.ok) {
                logger.error(`Failed to fetch scores for ${sportKey}:`, await scoresResponse.text());
                continue;
            }
            const scoresData = await scoresResponse.json();
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
            logger.log(`Successfully updated scores for ${sportKey}.`);
        } catch (error) {
            logger.error(`Error processing scores for ${sportKey}:`, error);
        }
    }
    
    logger.log(`Finished update cycle. Updated odds for ${updatedOddsCount} bookmakers and scores for ${updatedScoresCount} games.`);
    return { success: true, updatedOddsCount, updatedScoresCount };
});

