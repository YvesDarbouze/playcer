
import {initializeApp} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import {getFirestore, Timestamp, FieldValue} from "firebase-admin/firestore";
import {onUserCreate} from "firebase-functions/v2/auth";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import {logger} from "firebase-functions";
import { v4 as uuidv4 } from "uuid";

// Initialize Firebase Admin SDK
initializeApp();
const db = getFirestore();
const auth = getAuth();


// --- PLACEHOLDER THIRD-PARTY SERVICES ---
// In a real application, these would interact with external APIs.

const paymentGateway = {
    async processDeposit(userId: string, amount: number, paymentToken: string): Promise<{success: boolean, transactionId: string}> {
        logger.log(`Processing deposit for user ${userId} of amount ${amount} with token ${paymentToken}.`);
        // In a real app, interact with Stripe, Braintree, etc.
        return { success: true, transactionId: `deposit_${uuidv4()}` };
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
    }
}

const sportsDataAPI = {
     async getEventResult(sportKey: string, eventId: string): Promise<{ winnerTeamName: string | null, status: 'Final' | 'InProgress' }> {
        logger.log(`Fetching result for event ${eventId} from sports data oracle.`);
        const apiKey = process.env.ODDS_API_KEY;

        if (!apiKey || apiKey === 'YOUR_ODDS_API_KEY') {
            logger.warn(`ODDS_API_KEY is not set. Returning mock winner for event ${eventId}.`);
            // Return a mock result for demonstration when API key is not available
            return { winnerTeamName: 'Team A', status: 'Final' };
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

  const twitterProvider = user.providerData.find(
    (provider) => provider.providerId === "twitter.com"
  );

  const username = twitterProvider?.screenName || `user_${uid.substring(0, 5)}`;
  const twitterId = twitterProvider?.uid || "";

  const userDocRef = db.collection("users").doc(uid);

  try {
    await userDocRef.set({
      twitterId: twitterId,
      displayName: displayName || username,
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

export const handleDeposit = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'You must be logged in to make a deposit.');
    }
    const { uid } = request.auth;
    const { amount, paymentToken } = request.data;

    if (typeof amount !== 'number' || amount <= 0 || !paymentToken) {
        throw new HttpsError('invalid-argument', 'A valid amount and payment token are required.');
    }
    
    const userDocRef = db.collection('users').doc(uid);
    const userDoc = await userDocRef.get();
    if (!userDoc.exists) {
        throw new HttpsError('not-found', 'User profile not found.');
    }
    const userData = userDoc.data()!;

    // --- Responsible Gaming: Deposit Limit Check ---
    const rgLimits = userData.responsibleGamingLimits?.deposit || {};
    const dailyLimit = rgLimits.daily || 0;
    const weeklyLimit = rgLimits.weekly || 0;
    const monthlyLimit = rgLimits.monthly || 0;
    
    if (dailyLimit > 0 || weeklyLimit > 0 || monthlyLimit > 0) {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        startOfWeek.setHours(0,0,0,0);
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const transactionsSnap = await db.collection('transactions')
            .where('userId', '==', uid)
            .where('type', '==', 'deposit')
            .where('status', '==', 'completed')
            .where('createdAt', '>=', startOfMonth) // Most broad range, then filter in code
            .get();

        let dailyTotal = 0;
        let weeklyTotal = 0;
        let monthlyTotal = 0;

        transactionsSnap.forEach(doc => {
            const tx = doc.data();
            const txDate = (tx.createdAt as Timestamp).toDate();
            monthlyTotal += tx.amount;
            if (txDate >= startOfWeek) weeklyTotal += tx.amount;
            if (txDate >= startOfDay) dailyTotal += tx.amount;
        });

        if (dailyLimit > 0 && (dailyTotal + amount) > dailyLimit) {
            throw new HttpsError('failed-precondition', `Deposit would exceed your daily limit of $${dailyLimit}.`);
        }
        if (weeklyLimit > 0 && (weeklyTotal + amount) > weeklyLimit) {
            throw new HttpsError('failed-precondition', `Deposit would exceed your weekly limit of $${weeklyLimit}.`);
        }
        if (monthlyLimit > 0 && (monthlyTotal + amount) > monthlyLimit) {
            throw new HttpsError('failed-precondition', `Deposit would exceed your monthly limit of $${monthlyLimit}.`);
        }
    }
    // --- End RG Check ---


    try {
        const depositResult = await paymentGateway.processDeposit(uid, amount, paymentToken);
        if (!depositResult.success) {
            throw new HttpsError('aborted', 'Payment processing failed.');
        }

        await db.runTransaction(async (transaction) => {
            transaction.update(userDocRef, { walletBalance: FieldValue.increment(amount) });

            const transactionDocRef = db.collection('transactions').doc(depositResult.transactionId);
            transaction.set(transactionDocRef, {
                userId: uid,
                type: 'deposit',
                amount: amount,
                status: 'completed',
                gatewayTransactionId: depositResult.transactionId,
                createdAt: Timestamp.now(),
            });
        });

        logger.log(`Successfully processed deposit for user ${uid}.`);
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
    
    if (!sportKey || !eventId || !eventDate || !homeTeam || !awayTeam || !betType || !teamSelection || stake === undefined) {
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
            marketDescription: marketDescription || "N/A",
            outcomeDescription: outcomeDescription || "N/A",
            line: line ?? null,
            odds,
            teamSelection,
            stake,
            status: 'open',
            isPublic,
            winnerId: null,
            createdAt: Timestamp.now(),
            matchedAt: null,
            settledAt: null,
        };

        const betDocRef = db.collection('bets').doc(betId);
        transaction.set(betDocRef, newBet);
        
        const userBetDocRef = userDocRef.collection('userBets').doc(betId);
        transaction.set(userBetDocRef, {
            betRef: betDocRef,
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

        const creatorDocRef = db.collection('users').doc(creatorId);
        const creatorDoc = await transaction.get(creatorDocRef);
        if (!creatorDoc.exists) throw new HttpsError('not-found', 'Creator profile not found.');

        const creatorData = creatorDoc.data()!;
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
        transaction.set(userBetDocRef, { betRef: betDocRef, role: 'taker', createdAt: Timestamp.now() });

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

    // 5. Lock funds in escrow (outside of Firestore transaction)
    const betData = (await betDocRef.get()).data()!;
    const totalPot = betData.stake * 2;
    await escrowService.lockFunds(betId, totalPot);
    // In a real app, you'd save the escrowId to the bet document.

    logger.log(`Bet ${betId} successfully matched by ${challengerId}.`);
    return { success: true, message: "Bet accepted and matched!" };
});

export const processBetOutcome = onCall(async (request) => {
    // In production, this should be a scheduled function and secured.
    logger.log("Starting processBetOutcome...");
    
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
                    await processPayout({ betId, winnerId, stake: betData.stake, loserId: winnerId === betData.creatorId ? betData.challengerId : betData.creatorId });
                    await betDoc.ref.update({ status: 'settled', winnerId, settledAt: Timestamp.now() });
                    processedCount++;
                } else {
                    // Handle push/void cases
                    await betDoc.ref.update({ status: 'void', settledAt: Timestamp.now() });
                    // Here you would also refund the stakes
                    logger.log(`Bet ${betId} resulted in a push/void.`);
                }
            }
        } catch (error) {
            logger.error(`Failed to process outcome for bet ${betId}:`, error);
        }
    }

    logger.log(`Finished processBetOutcome. Processed ${processedCount} bets.`);
    return { success: true, processedCount };
});

// This is not a callable function, but a helper for processBetOutcome
async function processPayout(data: { betId: string, winnerId: string, loserId: string | null, stake: number }) {
    const { betId, winnerId, loserId, stake } = data;
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

    // In a real app, you would release funds from the real escrow service.
    await escrowService.releaseFunds(`escrow_${betId}`, winnerId);

    logger.log(`Payout for bet ${betId} processed for winner ${winnerId}.`);
}


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
