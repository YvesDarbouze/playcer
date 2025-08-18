

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
import { startStreaming } from "./stream";


// Initialize Algolia client
// Ensure you have set these environment variables in your Firebase project configuration
const algoliaClient = algoliasearch.default(process.env.ALGOLIA_APP_ID!, process.env.ALGOLIA_API_KEY!);
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


// --- THIRD-PARTY SERVICES ---

const sportsDataAPI = {
     async getEventResult(sportKey: string, eventId: string): Promise<{ home_score: number, away_score: number, status: 'Final' | 'InProgress' }> {
        functions.logger.log(`Fetching result for event ${eventId} from sports data oracle.`);
        // This is a mock implementation as the new API structure for single event results is not provided.
        // In a real scenario, this would call the new API.
        if (Math.random() > 0.5) {
             return { home_score: Math.floor(Math.random() * 100), away_score: Math.floor(Math.random() * 100), status: 'Final' };
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
             filters: 'status:pending OR isPublic:true'
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
        line,
        isPublic,
        twitterShareUrl,
        bookmakerKey,
        odds,
        period,
    } = request.data;
    
    // Basic validation
    if (!eventId || !eventDate || !homeTeam || !awayTeam || !betType || !chosenOption || !stakeAmount || !bookmakerKey || !odds || !period) {
        throw new HttpsError('invalid-argument', 'Missing required bet information.');
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
            line: line ?? null,
            status: 'pending',
            isPublic: isPublic,
            twitterShareUrl: twitterShareUrl || null,
            winnerId: null,
            loserId: null,
            createdAt: Timestamp.now(),
            settledAt: null,
            outcome: null,
            bookmakerKey,
            odds,
            period,
        };

        const betDocRef = db.collection('bets').doc(betId);
        transaction.set(betDocRef, newBet);

        if (newBet.isPublic) {
            await betsIndex.saveObject({ ...newBet, objectID: betId });
        }
        
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
                const { homeTeam, awayTeam, creatorId, takerId, chosenOption, line, betType } = betData;

                if (betType === 'moneyline') {
                    if (home_score > away_score && chosenOption === homeTeam) {
                        winnerId = creatorId;
                    } else if (away_score > home_score && chosenOption === awayTeam) {
                        winnerId = creatorId;
                    } else if (home_score > away_score && chosenOption !== homeTeam) {
                         winnerId = takerId;
                    } else if (away_score > home_score && chosenOption !== awayTeam) {
                         winnerId = takerId;
                    }
                } else if (betType === 'spread') {
                    const creatorPickedHome = chosenOption === homeTeam;
                    if (creatorPickedHome && (home_score + line) > away_score) {
                        winnerId = creatorId;
                    } else if (!creatorPickedHome && (away_score + line) > home_score) {
                        winnerId = creatorId;
                    } else {
                        winnerId = takerId;
                    }
                } else if (betType === 'totals') {
                     const totalScore = home_score + away_score;
                     const creatorPickedOver = chosenOption === 'Over';
                     if ((creatorPickedOver && totalScore > line) || (!creatorPickedOver && totalScore < line)) {
                         winnerId = creatorId;
                     } else if (totalScore !== line) { // Don't assign winner on push
                         winnerId = takerId;
                     }
                }
                
                if (winnerId) {
                    const loserId = winnerId === creatorId ? takerId : creatorId;
                    await processPayout({ 
                        betId, 
                        winnerId, 
                        stake: betData.stakeAmount, 
                        loserId,
                    });
                    await betDoc.ref.update({ status: 'resolved', winnerId, loserId, outcome: 'win', settledAt: Timestamp.now() });
                    processedCount++;
                } else {
                    // This is a PUSH. Handle refunding both parties.
                     await processPayout({ 
                        betId, 
                        winnerId: null, 
                        stake: betData.stakeAmount, 
                        loserId: null,
                    });
                    await betDoc.ref.update({ status: 'resolved', outcome: 'draw', settledAt: Timestamp.now() });
                    processedCount++;
                }
                 await betsIndex.deleteObject(betId);
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
            // Standard win/loss scenario
            const winnerDocRef = db.collection('users').doc(winnerId);
            const loserDocRef = db.collection('users').doc(loserId);
            const commission = stake * PLATFORM_COMMISSION_RATE;
            const payoutToWinner = stake * 2 - commission; 

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
            // This is a PUSH (tie/draw). Refund both users.
            const betDoc = await transaction.get(db.collection('bets').doc(betId));
            if (!betDoc.exists) return; // Should not happen in this flow
            const betData = betDoc.data()!;
            
            const creatorDocRef = db.collection('users').doc(betData.creatorId);
            const takerDocRef = db.collection('users').doc(betData.takerId);
            
            // Increment wallet balances for both users by the stake amount
            transaction.update(creatorDocRef, { walletBalance: FieldValue.increment(stake), totalBets: FieldValue.increment(1) });
            transaction.update(takerDocRef, { walletBalance: FieldValue.increment(stake), totalBets: FieldValue.increment(1) });
            
            // Log the refund transactions
            const creatorTxId = db.collection('transactions').doc().id;
            const takerTxId = db.collection('transactions').doc().id;
             transaction.set(db.collection('transactions').doc(creatorTxId), {
                userId: betData.creatorId, type: 'bet_payout', amount: stake, status: 'completed', relatedBetId: betId, createdAt: Timestamp.now()
            });
             transaction.set(db.collection('transactions').doc(takerTxId), {
                userId: betData.takerId, type: 'bet_payout', amount: stake, status: 'completed', relatedBetId: betId, createdAt: Timestamp.now()
            });
        }
    });

    functions.logger.log(`Payout for bet ${betId} processed.`);
}

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

export const getConsensusOdds = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'You must be logged in to perform this action.');
    }
    const { gameId } = request.data;
    if (!gameId) {
        throw new HttpsError('invalid-argument', 'A gameId must be provided.');
    }
    
    const API_KEY = process.env.ODDS_API_KEY || '7ee3cc9f9898b050512990bd2baadddf';
    const API_BASE_URL = 'https://api.sportsgameodds.com/v2';
    
    try {
        const response = await fetch(`${API_BASE_URL}/events?eventIDs=${gameId}`, {
             headers: { 'x-api-key': API_KEY },
        });

        if (!response.ok) {
            throw new HttpsError('internal', `Failed to fetch event data. Status: ${response.status}`);
        }
        
        const eventData = await response.json();

        if (!eventData.success || !eventData.data || eventData.data.length === 0) {
            throw new HttpsError('not-found', 'Could not find event data for the given ID.');
        }

        return { success: true, data: eventData.data[0] };
    } catch(e: any) {
        functions.logger.error(`Error fetching consensus odds for game ${gameId}:`, e);
        if (e instanceof HttpsError) {
            throw e;
        }
        throw new HttpsError('internal', 'An unexpected error occurred while fetching consensus odds.');
    }
});
