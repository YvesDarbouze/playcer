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
  email?: string; 
  createdAt: Timestamp;
  walletBalance: number;
  wins: number;
  losses: number;
  kycStatus: 'pending' | 'verified' | 'rejected';
  responsibleGamingLimits: {
      deposit: {
          daily: number;
          weekly: number;
          monthly: number;
      };
      wager: {
          daily: number;
          weekly: number;
          monthly: number;
      };
  };
  selfExclusion: {
      isActive: boolean;
      startDate: Timestamp | null;
      endDate: Timestamp | null; // null for permanent
  };
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
  creatorUsername: string;
  creatorPhotoURL: string;
  challengerId: string | null;
  challengerUsername: string | null;
  challengerPhotoURL: string | null;
  sportKey: string;
  eventId: string;
  eventDate: Timestamp;
  homeTeam: string;
  awayTeam: string;
  betType: 'spread' | 'moneyline' | 'total';
  marketDescription: string;
  outcomeDescription: string;
  line: number | null;
  odds: number;
  teamSelection: string;
  stake: number;
  status: 'open' | 'matched' | 'settled' | 'void' | 'disputed';
  isPublic: boolean;
  winnerId: string | null;
  createdAt: Timestamp; 
  matchedAt: Timestamp | null;
  settledAt: Timestamp | null;
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
