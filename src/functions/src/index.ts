
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
     async getEventResult(sportKey: string, eventId: string): Promise<{ winnerTeamName: string | null, status: 'Final' | 'InProgress' }> {
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
                return { winnerTeamName: null, status: 'InProgress' };
            }

            const homeScore = parseInt(eventResult.scores.find((s: any) => s.name === eventResult.home_team)?.score || '0');
            const awayScore = parseInt(eventResult.scores.find((s: any) => s.name === eventResult.away_team)?.score || '0');

            if (homeScore > awayScore) {
                return { winnerTeamName: eventResult.home_team, status: 'Final' };
            } else if (awayScore > homeScore) {
                return { winnerTeamName: eventResult.away_team, status: 'Final' };
            } else {
                return { winnerTeamName: null, status: 'Final' }; // Push/Tie
            }

        } catch (error) {
            logger.error(`Exception fetching event result for ${eventId}:`, error);
            // In case of any error, return a non-final status to retry later
            return { winnerTeamName: null, status: 'InProgress' };
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
      walletBalance: 0.00,
      wins: 0,
      losses: 0,
      kycStatus: "pending",
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
    
    // Create a search-only API key with filters to prevent users from seeing each other's private data
    const searchKey = algoliaClient.generateSecuredApiKey(
        process.env.ALGOLIA_SEARCH_ONLY_API_KEY!,
        {
            // You can add filters here if you have user-specific data you want to protect
            // For example: `filters: `_tags:${request.auth.uid} OR isPublic:true``
            // For now, we will allow searching on all public records.
             filters: 'isPublic:true'
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

    // --- Self-Exclusion Check ---
    if (userData.selfExclusion?.isActive === true) {
        throw new HttpsError('failed-precondition', 'Your account is currently in a self-exclusion period. You cannot make a deposit.');
    }
    // --- End Self-Exclusion Check ---


    // --- Responsible Gaming: Deposit Limit Check ---
    const rgLimits = userData.responsibleGamingLimits?.deposit || {};
    const dailyLimit = rgLimits.daily || 0;
    const weeklyLimit = rgLimits.weekly || 0;
    const monthlyLimit = rgLimits.monthly || 0;
    
    if (dailyLimit > 0 || weeklyLimit > 0 || monthlyLimit > 0) {
        const now = new Date();
        const startOfMonth = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

        const transactionsSnap = await db.collection('transactions')
            .where('userId', '==', uid)
            .where('type', '==', 'deposit')
            .where('status', '==', 'completed')
            .where('createdAt', '>=', startOfMonth) // Most broad range, then filter in code
            .get();

        let dailyTotal = 0;
        let weeklyTotal = 0;
        let monthlyTotal = 0;
        
        const startOfDay = new Date(now.getTime() - (24 * 60 * 60 * 1000));
        const startOfWeek = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));

        transactionsSnap.forEach(doc => {
            const tx = doc.data();
            const txDate = (tx.createdAt as Timestamp).toDate();
            monthlyTotal += tx.amount;
            if (txDate >= startOfWeek) weeklyTotal += tx.amount;
            if (txDate >= startOfDay) dailyTotal += tx.amount;
        });

        if (dailyLimit > 0 && (dailyTotal + depositAmount) > dailyLimit) {
            throw new HttpsError('failed-precondition', `Deposit would exceed your daily limit of $${dailyLimit}.`);
        }
        if (weeklyLimit > 0 && (weeklyTotal + depositAmount) > weeklyLimit) {
            throw new HttpsError('failed-precondition', `Deposit would exceed your weekly limit of $${weeklyLimit}.`);
        }
        if (monthlyLimit > 0 && (monthlyTotal + depositAmount) > monthlyLimit) {
            throw new HttpsError('failed-precondition', `Deposit would exceed your monthly limit of $${monthlyLimit}.`);
        }
    }
    // --- End RG Check ---


    try {
        const intentResult = await paymentGateway.createPaymentIntent(uid, depositAmount);
        if (!intentResult.success) {
            throw new HttpsError('aborted', 'Payment intent creation failed.');
        }

        // SIMULATION: In a real app, a webhook would trigger the following function.
        // For this demo, we'll call it directly to complete the flow.
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

    const { uid } = request.auth;
    const {
        sportKey,
        eventId,
        eventDate,
        homeTeam,
        awayTeam,
        betType,
        marketDescription,
        outcomeDescription,
        line,
        odds,
        teamSelection,
        stake,
        isPublic = true,
    } = request.data;
    
    if (!sportKey || !eventId || !eventDate || !homeTeam || !awayTeam || !betType || !teamSelection || stake === undefined || !marketDescription || !outcomeDescription) {
        throw new HttpsError('invalid-argument', 'Missing required bet information.');
    }
    
    if (typeof stake !== 'number' || stake <= 0) {
        throw new HttpsError('invalid-argument', 'The stake must be a positive number.');
    }

    const userDocRef = db.collection('users').doc(uid);
    const betId = uuidv4();

    await db.runTransaction(async (transaction) => {
        const userDoc = await transaction.get(userDocRef);
        if (!userDoc.exists) throw new HttpsError('not-found', 'User profile not found.');
        
        const userData = userDoc.data()!;
        if (userData.kycStatus !== 'verified') {
            throw new HttpsError('failed-precondition', 'You must verify your identity to create a bet.');
        }
        if (userData.walletBalance < stake) {
            throw new HttpsError('failed-precondition', 'Insufficient wallet balance to create this bet.');
        }

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
            marketDescription: marketDescription,
            outcomeDescription: outcomeDescription,
            line: line ?? null,
            odds,
            teamSelection,
            stake,
            status: 'open',
            isPublic,
            winnerId: null,
            escrowId: null,
            createdAt: Timestamp.now(),
            matchedAt: null,
            settledAt: null,
        };

        const betDocRef = db.collection('bets').doc(betId);
        transaction.set(betDocRef, newBet);
        
        // Create the userBet subcollection entry for the creator
        const userBetDocRef = userDocRef.collection('userBets').doc(betId);
        transaction.set(userBetDocRef, {
            betRef: betDocRef.path,
            role: 'creator',
            createdAt: Timestamp.now()
        });
    });
    
    logger.log(`Bet ${betId} created by user ${uid}`);
    return { success: true, betId, uniqueLink: `/bet/${betId}` };
});


export const matchBet = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'You must be logged in to accept a bet.');
    }

    const { uid: challengerId } = request.auth;
    const { betId } = request.data;
    if (!betId) throw new HttpsError('invalid-argument', 'The `betId` must be provided.');

    const betDocRef = db.collection('bets').doc(betId);
    const challengerDocRef = db.collection('users').doc(challengerId);
    
    // --- Firestore Transaction ---
    // This block ensures all database reads and writes are atomic.
    await db.runTransaction(async (transaction) => {
        const betDoc = await transaction.get(betDocRef);
        const challengerDoc = await transaction.get(challengerDocRef);
        
        if (!betDoc.exists) throw new HttpsError('not-found', 'Bet not found.');
        if (!challengerDoc.exists) throw new HttpsError('not-found', 'Challenger profile not found.');

        const betData = betDoc.data()!;
        const challengerData = challengerDoc.data()!;
        const { creatorId, stake, status } = betData;

        if (creatorId === challengerId) throw new HttpsError('failed-precondition', 'You cannot accept your own bet.');
        if (status !== 'open') throw new HttpsError('failed-precondition', 'This bet is no longer open.');
        if (challengerData.kycStatus !== 'verified') throw new HttpsError('failed-precondition', 'You must complete identity verification to accept a bet.');

        const creatorDocRef = db.collection('users').doc(creatorId);
        const creatorDoc = await transaction.get(creatorDocRef);
        if (!creatorDoc.exists) throw new HttpsError('not-found', 'Creator profile not found.');

        const creatorData = creatorDoc.data()!;
        if (creatorData.kycStatus !== 'verified') throw new HttpsError('failed-precondition', 'The bet creator is not verified.');
        if (creatorData.walletBalance < stake) throw new HttpsError('failed-precondition', 'Creator has insufficient funds.');
        if (challengerData.walletBalance < stake) throw new HttpsError('failed-precondition', 'You have insufficient funds.');

        // 1. Debit both users
        transaction.update(creatorDocRef, { walletBalance: FieldValue.increment(-stake) });
        transaction.update(challengerDocRef, { walletBalance: FieldValue.increment(-stake) });

        // 2. Update Bet Document
        transaction.update(betDocRef, {
            challengerId: challengerId,
            challengerUsername: challengerData.username,
            challengerPhotoURL: challengerData.photoURL,
            status: 'matched',
            matchedAt: Timestamp.now()
        });

        // 3. Create userBet for challenger
        const userBetDocRef = challengerDocRef.collection('userBets').doc(betId);
        transaction.set(userBetDocRef, { betRef: betDocRef.path, role: 'taker', createdAt: Timestamp.now() });

        // 4. Create transaction logs for stake debits
        const creatorTxId = db.collection('transactions').doc().id;
        const challengerTxId = db.collection('transactions').doc().id;
        transaction.set(db.collection('transactions').doc(creatorTxId), {
            userId: creatorId, type: 'bet_stake', amount: -stake, status: 'completed', relatedBetId: betId, createdAt: Timestamp.now()
        });
        transaction.set(db.collection('transactions').doc(challengerTxId), {
            userId: challengerId, type: 'bet_stake', amount: -stake, status: 'completed', relatedBetId: betId, createdAt: Timestamp.now()
        });
    });
    // --- End of Transaction ---

    // --- Escrow Integration (Post-Transaction) ---
    // This happens only if the transaction above was successful.
    try {
        const betData = (await betDocRef.get()).data()!;
        const totalPot = betData.stake * 2;
        
        const escrowResult = await escrowService.lockFunds(betId, totalPot);
        if (!escrowResult.success) {
            // CRITICAL: If escrow fails, we need to revert the state.
            // This would involve a complex compensation transaction (e.g., refunding users).
            // For this simulation, we'll log a critical error.
            logger.error(`CRITICAL: Escrow failed for bet ${betId} after transaction committed. Manual intervention required.`);
            throw new HttpsError('aborted', 'Failed to secure funds in escrow. Please contact support.');
        }

        // Save the escrow ID to the bet document.
        await betDocRef.update({ escrowId: escrowResult.escrowId });

        logger.log(`Bet ${betId} successfully matched by ${challengerId} and funds locked in escrow ${escrowResult.escrowId}.`);
        return { success: true, message: "Bet accepted and matched!" };

    } catch(error) {
        logger.error(`Error during post-transaction escrow for bet ${betId}:`, error);
        // If the error is an HttpsError, rethrow it. Otherwise, wrap it.
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', 'An error occurred during the escrow process.');
    }
});

export const processBetOutcomes = onCall(async (request) => {
    // In production, this should be a scheduled function and secured.
    // For this demo, it's an onCall function that can be triggered manually or by a cron job.
    logger.log("Starting processBetOutcomes...");
    
    const now = Timestamp.now();
    const query = db.collection('bets')
        .where('status', '==', 'matched')
        .where('eventDate', '<=', now);
        
    const matchedBetsSnap = await query.get();

    if (matchedBetsSnap.empty) {
        logger.log("No matched bets found for processing.");
        return { success: true, message: "No bets to process." };
    }

    let processedCount = 0;
    const batch = db.batch();

    for (const betDoc of matchedBetsSnap.docs) {
        const betId = betDoc.id;
        const betData = betDoc.data();

        // Skip disputed bets from automatic settlement
        if (betData.status === 'disputed') {
            logger.log(`Skipping disputed bet ${betId}.`);
            continue;
        }
        
        try {
            const result = await sportsDataAPI.getEventResult(betData.sportKey, betData.eventId);

            if (result.status === 'Final') {
                let winnerId = null;

                if (betData.betType === 'moneyline' || betData.betType === 'spread') {
                    if (result.winnerTeamName === betData.teamSelection) {
                         winnerId = betData.creatorId;
                    } else if (result.winnerTeamName) { // if there is a winner, and it wasn't the creator's pick
                         winnerId = betData.challengerId;
                    }
                }
                
                // If there's a winner, update status and process payout
                if (winnerId) {
                    await processPayout({ 
                        betId, 
                        winnerId, 
                        stake: betData.stake, 
                        loserId: winnerId === betData.creatorId ? betData.challengerId : betData.creatorId,
                        escrowId: betData.escrowId
                    });
                    batch.update(betDoc.ref, { status: 'settled', winnerId, settledAt: Timestamp.now() });
                    processedCount++;
                } else {
                    // Handle push/void cases
                    batch.update(betDoc.ref, { status: 'void', settledAt: Timestamp.now() });
                    // Here you would also refund the stakes
                    logger.log(`Bet ${betId} resulted in a push/void.`);
                }
            }
        } catch (error) {
            logger.error(`Failed to process outcome for bet ${betId}:`, error);
        }
    }
    
    await batch.commit();
    logger.log(`Finished processBetOutcomes. Processed ${processedCount} bets.`);
    return { success: true, processedCount };
});

// This is not a callable function, but a helper for processBetOutcome
async function processPayout(data: { betId: string, winnerId: string, loserId: string | null, stake: number, escrowId: string | null }) {
    const { betId, winnerId, loserId, stake, escrowId } = data;
    const PLATFORM_COMMISSION_RATE = 0.05; // 5%
    
    const winnerDocRef = db.collection('users').doc(winnerId);
    
    const winnings = stake; // The amount the user won, on top of getting their stake back
    const commission = winnings * PLATFORM_COMMISSION_RATE;
    const payoutAmount = stake + (winnings - commission); // stake back + winnings - commission

    await db.runTransaction(async (transaction) => {
        // 1. Credit winner's wallet and increment win count
        transaction.update(winnerDocRef, { 
            walletBalance: FieldValue.increment(payoutAmount),
            wins: FieldValue.increment(1)
        });

        // 2. Increment loser's loss count
        if (loserId) {
            const loserDocRef = db.collection('users').doc(loserId);
            transaction.update(loserDocRef, { losses: FieldValue.increment(1) });
        }

        // 3. Log payout transaction
        const payoutTxId = db.collection('transactions').doc().id;
        transaction.set(db.collection('transactions').doc(payoutTxId), {
            userId: winnerId,
            type: 'bet_payout',
            amount: payoutAmount,
            status: 'completed',
            relatedBetId: betId,
            createdAt: Timestamp.now()
        });

        // 4. Log commission transaction
        const commissionTxId = db.collection('transactions').doc().id;
        transaction.set(db.collection('transactions').doc(commissionTxId), {
            userId: winnerId, // Attributed to the winner's transaction
            type: 'commission',
            amount: -commission,
            status: 'completed',
            relatedBetId: betId,
            createdAt: Timestamp.now()
        });
    });

    if (escrowId) {
        await escrowService.releaseFunds(escrowId, winnerId);
    } else {
        logger.warn(`Payout for bet ${betId} processed, but no escrowId was found.`);
    }

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
    // This function can be triggered by Cloud Scheduler.
    // Ensure the function is secured if not using Cloud Scheduler's built-in auth.
    logger.log("Starting to update odds and scores.");
    const apiKey = process.env.ODDS_API_KEY;

    if (!apiKey || apiKey === '9506477182d2f2335317a695b5e875e4') {
        throw new HttpsError('internal', 'ODDS_API_KEY is not configured.');
    }

    const now = new Date();
    const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
    const fortyEightHoursFromNow = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    // Query for games that are not complete and are within the time window.
    const gamesQuery = db.collection('games')
        .where('is_complete', '!=', true)
        .where('commence_time', '>=', Timestamp.fromDate(sixHoursAgo))
        .where('commence_time', '<=', Timestamp.fromDate(fortyEightHoursFromNow));

    const gamesSnapshot = await gamesQuery.get();
    if (gamesSnapshot.empty) {
        logger.log("No relevant games found to update.");
        return { success: true, message: "No games to update." };
    }

    // Group games by sport_key
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

    // Process each sport group
    for (const sportKey in gamesBySport) {
        // 1. Fetch and update odds
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
        
        // 2. Fetch and update scores
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


// --- ADMIN FUNCTIONS ---

const ensureIsAdmin = (context: any) => {
    if (!context.auth) {
        throw new HttpsError('unauthenticated', 'You must be logged in.');
    }
    if (context.auth.token.admin !== true) {
        throw new HttpsError('permission-denied', 'You must be an admin to perform this action.');
    }
};

export const listAllUsers = onCall(async (request) => {
    ensureIsAdmin(request);
    
    try {
        const listUsersResult = await auth.listUsers(1000); // paginate if more needed
        const users = listUsersResult.users.map((userRecord) => {
            const customClaims = (userRecord.customClaims || {}) as { admin?: boolean };
            return {
                uid: userRecord.uid,
                email: userRecord.email,
                displayName: userRecord.displayName,
                photoURL: userRecord.photoURL,
                disabled: userRecord.disabled,
                creationTime: userRecord.metadata.creationTime,
                lastSignInTime: userRecord.metadata.lastSignInTime,
                isAdmin: customClaims.admin === true,
            };
        });
        return { success: true, users };
    } catch (error) {
        logger.error('Error listing users:', error);
        throw new HttpsError('internal', 'Unable to list users.');
    }
});

export const suspendUser = onCall(async (request) => {
    ensureIsAdmin(request);
    const { uid, suspend } = request.data;
    if (!uid) {
        throw new HttpsError('invalid-argument', 'A UID must be provided.');
    }

    try {
        await auth.updateUser(uid, { disabled: suspend });
        const message = `User ${uid} has been ${suspend ? 'suspended' : 'unsuspended'}.`;
        logger.log(message);
        return { success: true, message };
    } catch (error) {
        logger.error(`Error updating user ${uid}:`, error);
        throw new HttpsError('internal', `Failed to update user status.`);
    }
});

export const deleteUser = onCall(async (request) => {
    ensureIsAdmin(request);
    const { uid } = request.data;
    if (!uid) {
        throw new HttpsError('invalid-argument', 'A UID must be provided.');
    }

    try {
        await auth.deleteUser(uid);
        // Optionally, also delete their Firestore data
        await db.collection('users').doc(uid).delete();
        const message = `User ${uid} has been permanently deleted.`;
        logger.log(message);
        return { success: true, message };
    } catch (error) {
        logger.error(`Error deleting user ${uid}:`, error);
        throw new HttpsError('internal', `Failed to delete user.`);
    }
});

export const issueManualRefund = onCall(async (request) => {
    ensureIsAdmin(request);
    const { userId, betId } = request.data;
    // In a real app, this would involve complex logic to verify the bet,
    // fetch the stake, and credit the user's wallet.
    // This is a simplified placeholder.
    logger.log(`Admin initiated manual refund for user ${userId} concerning bet ${betId}.`);
    return { success: true, message: `Refund process initiated for bet ${betId}.` };
});

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
    
    try {
        const disputeDoc = await disputeRef.get();
        if (!disputeDoc.exists) {
            throw new HttpsError('not-found', 'Dispute not found.');
        }
        const disputeData = disputeDoc.data()!;
        if (disputeData.status !== 'open') {
            throw new HttpsError('failed-precondition', 'This dispute has already been resolved.');
        }
        
        const betRef = db.collection('bets').doc(disputeData.betId);
        const betDoc = await betRef.get();
        if (!betDoc.exists) {
            throw new HttpsError('not-found', `Related bet ${disputeData.betId} not found.`);
        }
        const betData = betDoc.data()!;

        // Handle based on ruling
        if (ruling === 'void') {
            await escrowService.refundFunds(betData.escrowId, [betData.creatorId, betData.challengerId]);
            await db.runTransaction(async (transaction) => {
                 transaction.update(betRef, { status: 'void', settledAt: Timestamp.now() });
                 transaction.update(disputeRef, {
                    status: 'resolved',
                    resolution: { outcome: 'void', adminNotes, resolvedAt: Timestamp.now() }
                });
                // Refund stakes to both users
                const creatorRef = db.collection('users').doc(betData.creatorId);
                const takerRef = db.collection('users').doc(betData.challengerId);
                transaction.update(creatorRef, { walletBalance: FieldValue.increment(betData.stake) });
                transaction.update(takerRef, { walletBalance: FieldValue.increment(betData.stake) });
            });
        } else {
            const winnerId = ruling === 'creator_wins' ? betData.creatorId : betData.challengerId;
            const loserId = ruling === 'creator_wins' ? betData.challengerId : betData.creatorId;

            await processPayout({
                betId: betDoc.id,
                winnerId,
                loserId,
                stake: betData.stake,
                escrowId: betData.escrowId,
            });

            await db.runTransaction(async (transaction) => {
                transaction.update(betRef, { status: 'settled', winnerId, settledAt: Timestamp.now() });
                transaction.update(disputeRef, {
                    status: 'resolved',
                    resolution: { outcome: ruling, adminNotes, resolvedAt: Timestamp.now() }
                });
            });
        }

        // TODO: Send notifications to users about the outcome.

        logger.log(`Dispute ${disputeId} resolved with ruling: ${ruling}.`);
        return { success: true, message: 'Dispute resolved successfully.' };

    } catch (error) {
        logger.error(`Error resolving dispute ${disputeId}:`, error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', 'An internal error occurred while resolving the dispute.');
    }
});
