import { Timestamp } from "firebase/firestore";

export type Court = {
  id: string;
  name: string;
  address: string;
  rating: number;
  busyness: number;
  imageUrl: string;
  features: string[];
  reviews: {
    author: string;
    rating: number;
    comment: string;
  }[];
  coordinates: {
    lat: number;
    lng: number;
  };
};

export type User = {
  id: string; // This is the UID from Firebase Auth
  twitterId: string;
  displayName: string;
  username: string;
  photoURL: string;
  email?: string; // from new schema
  createdAt: Timestamp;
  walletBalance: number;
  wins: number;
  losses: number;
  kycStatus: 'pending' | 'verified' | 'rejected';
  responsibleGamingLimits: Record<string, any>; // map
  selfExclusion: Record<string, any>; // map
};

export type Game = {
    id: string;
    sport_key: string;
    sport_title: string;
    commence_time: string;
    home_team: string;
    away_team: string;
    bookmakers: {
        key: string;
        title: string;
        last_update: string;
        markets: {
            key: 'h2h' | 'spreads' | 'totals';
            last_update: string;
            outcomes: {
                name: string;
                price: number;
                point?: number;
            }[];
        }[];
    }[];
};

export type Bet = {
  id: string; 
  creatorId: string;
  creatorUsername: string; // creatorDisplayName in new schema
  creatorPhotoURL: string;
  challengerId: string | null; // takerId in new schema
  challengerUsername: string | null; // takerDisplayName in new schema
  challengerPhotoURL: string | null; // takerPhotoURL in new schema
  sportKey: string;
  eventId: string;
  eventDate: Timestamp;
  homeTeam: string;
  awayTeam: string;
  betType: 'spread' | 'moneyline' | 'total';
  marketDescription: string; // from new schema
  outcomeDescription: string; // from new schema
  line: number | null;
  odds: number;
  teamSelection: string;
  stake: number;
  status: 'open' | 'matched' | 'settled' | 'void' | 'disputed';
  isPublic: boolean; // from new schema
  winnerId: string | null;
  createdAt: Timestamp; 
  matchedAt: Timestamp | null; // from new schema
  settledAt: Timestamp | null; // from new schema
  uniqueLink: string;
};

// From new schema
export type UserBet = {
  betRef: string; // Using string to represent reference path
  role: 'creator' | 'taker';
  createdAt: Timestamp;
}

// From new schema
export type Transaction = {
  id: string;
  userId: string;
  type: 'deposit' | 'withdrawal' | 'bet_stake' | 'bet_payout' | 'commission';
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  relatedBetId: string | null;
  gatewayTransactionId: string | null;
  createdAt: Timestamp;
}

// From new schema
export type Dispute = {
  id: string;
  betId: string;
  creatorId: string;
  takerId: string;
  status: 'open' | 'under_review' | 'resolved';
  reason: string;
  resolution: string | null;
  createdAt: Timestamp;
  resolvedAt: Timestamp | null;
}
