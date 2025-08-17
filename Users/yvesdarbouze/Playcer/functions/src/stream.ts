
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import * as functions from 'firebase-functions';
import axios from 'axios';
import Pusher from 'pusher-js';

const db = getFirestore();

const API_KEY = '7ee3cc9f9898b050512990bd2baadddf';
const API_BASE_URL = 'https://api.sportsgameodds.com/v2';

const activeStreams: Record<string, { pusher: Pusher, channel: any }> = {};

async function connectToFeed(leagueID: string) {
    functions.logger.log(`[STREAM] Connecting to upcoming events for: ${leagueID}`);

    try {
        const response = await axios.get(`${API_BASE_URL}/stream/events`, {
            headers: { 'x-api-key': API_KEY },
            params: {
                feed: 'events:upcoming',
                leagueID: leagueID
            }
        });

        if (response.status !== 200 || !response.data) {
            throw new Error(`Failed to get stream config for ${leagueID}. Status: ${response.status}`);
        }

        const streamInfo = response.data;
        const { data: initialEvents, pusherKey, pusherOptions, channel: channelName } = streamInfo;
        
        functions.logger.log(`[STREAM] Config for ${leagueID}: channel=${channelName}, initialEvents=${initialEvents.length}`);

        // Save initial data
        await saveEventsToFirestore(initialEvents);
        
        const pusher = new Pusher(pusherKey, pusherOptions);
        
        pusher.connection.bind('state_change', (states: any) => {
             functions.logger.log(`[STREAM] Pusher state change for ${leagueID}: ${states.previous} -> ${states.current}`);
        });

        pusher.connection.bind('error', (error: any) => {
            functions.logger.error(`[STREAM] Pusher connection error for ${leagueID}:`, error);
        });

        const channel = pusher.subscribe(channelName);

        channel.bind('pusher:subscription_succeeded', () => {
            functions.logger.log(`[STREAM] Successfully subscribed to channel: ${channelName}`);
        });
        
        channel.bind('data', async (changedEvents: { eventID: string }[]) => {
            functions.logger.log(`[STREAM] Received update for ${changedEvents.length} event(s) in ${leagueID}`);
            const eventIDs = changedEvents.map(e => e.eventID).join(',');
            if (!eventIDs) return;

            try {
                const eventDataResponse = await axios.get(`${API_BASE_URL}/events`, {
                     headers: { 'x-api-key': API_KEY },
                     params: { eventIDs }
                });
                
                if (eventDataResponse.status !== 200 || !eventDataResponse.data) {
                    throw new Error(`Failed to fetch full event data for ${leagueID}. Status: ${eventDataResponse.status}`);
                }
                await saveEventsToFirestore(eventDataResponse.data.data);
            } catch (error) {
                functions.logger.error(`[STREAM] Error fetching/saving updated event data for ${leagueID}:`, error);
            }
        });

        activeStreams[leagueID] = { pusher, channel };

    } catch (error: any) {
        functions.logger.error(`[STREAM] Failed to connect to feed for ${leagueID}:`, error.message);
    }
}

async function saveEventsToFirestore(events: any[]) {
    if (!events || events.length === 0) return;

    const batch = db.batch();
    functions.logger.log(`[FIRESTORE] Saving ${events.length} events to Firestore.`);

    for (const event of events) {
        const gameRef = db.collection('games').doc(event.eventID);
        const gameDoc = {
            id: event.eventID,
            sport_key: event.league.leagueID.toLowerCase(),
            sport_title: event.league.leagueAbbreviation,
            commence_time: Timestamp.fromDate(new Date(event.status.startsAt)),
            home_team: event.teams.home.names.medium,
            away_team: event.teams.away.names.medium,
            is_complete: event.status.finished,
            home_score: event.scores.home,
            away_score: event.scores.away,
            last_update: Timestamp.now()
        };
        batch.set(gameRef, gameDoc, { merge: true });

        if (event.odds) {
             for (const bookmakerKey in event.odds) {
                const bookmakerData = event.odds[bookmakerKey];
                const oddsRef = gameRef.collection('bookmaker_odds').doc(bookmakerKey);
                batch.set(oddsRef, { ...bookmakerData, last_update: Timestamp.now() }, { merge: true });
            }
        }
    }

    try {
        await batch.commit();
        functions.logger.log(`[FIRESTORE] Successfully saved ${events.length} events.`);
    } catch(error) {
        functions.logger.error(`[FIRESTORE] Error committing batch:`, error);
    }
}

export async function startStreaming() {
    functions.logger.log('[STREAM] Initializing real-time event streaming...');
    try {
        // 1. Fetch all available sports
        const sportsResponse = await axios.get(`${API_BASE_URL}/sports`, { headers: { 'x-api-key': API_KEY } });
        if (sportsResponse.status !== 200 || !sportsResponse.data.data) {
            throw new Error("Could not fetch sports list from API.");
        }
        const sports = sportsResponse.data.data;
        functions.logger.log(`[STREAM] Found ${sports.length} sports.`);

        // 2. For each sport, fetch its leagues
        for (const sport of sports) {
            try {
                const leaguesResponse = await axios.get(`${API_BASE_URL}/leagues`, {
                    headers: { 'x-api-key': API_KEY },
                    params: { sportID: sport.sportID }
                });

                if (leaguesResponse.status !== 200 || !leaguesResponse.data.data) {
                    functions.logger.warn(`[STREAM] Could not fetch leagues for sport: ${sport.name}`);
                    continue;
                }
                const leagues = leaguesResponse.data.data;
                functions.logger.log(`[STREAM] Found ${leagues.length} leagues for sport ${sport.name}.`);

                // 3. For each league, connect to the feed
                for (const league of leagues) {
                    await connectToFeed(league.leagueID);
                }
            } catch (error: any) {
                 functions.logger.error(`[STREAM] Error processing leagues for sport ${sport.name}:`, error.message);
            }
        }
    } catch (error: any) {
        functions.logger.error('[STREAM] Fatal error during stream initialization:', error.message);
    }
}

export function stopStreaming() {
     functions.logger.log('[STREAM] Disconnecting all active streams.');
     for (const leagueID in activeStreams) {
         const { pusher, channel } = activeStreams[leagueID];
         if(channel?.name) pusher.unsubscribe(channel.name);
         if(pusher) pusher.disconnect();
     }
}
