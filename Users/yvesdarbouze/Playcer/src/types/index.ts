

import type { Timestamp } from "firebase/firestore";

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
  displayName: string;
  username: string; // This is the Twitter handle
  photoURL: string;
  email?: string;
  createdAt: string; // ISO string
  walletBalance: number;
  wins: number;
  losses: number;
  kycStatus: "pending" | "verified" | "rejected" | "in_review";
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
    startDate: string | null; // ISO string
    endDate: string | null; // ISO string, null for permanent
  };
};

export type Game = {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string; // ISO string
  home_team: string;
  away_team: string;
  home_score?: number;
  away_score?: number;
  is_complete?: boolean;
  bookmakers?: {
    key: string;
    title: string;
    last_update: string;
    markets: {
      key: "h2h" | "spreads" | "totals";
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
  eventId: string;
  eventDate: string; // ISO string
  homeTeam: string;
  awayTeam: string;
  creatorId: string;
  takerId: string | null;
  creatorUsername: string;
  creatorPhotoURL: string;
  takerUsername: string | null;
  takerPhotoURL: string | null;
  stakeAmount: number;
  betType: "moneyline" | "spread" | "totals";
  chosenOption: string; // e.g., 'Los Angeles Rams', 'Over', 'Under'
  line: number | null; // for spreads and totals, e.g., -7.5, 55.5
  status: "pending" | "accepted" | "resolved" | "cancelled" | "void";
  isPublic: boolean;
  twitterShareUrl: string | null;
  outcome: 'win' | 'loss' | 'draw' | null;
  winnerId: string | null;
  loserId: string | null;
  createdAt: string; // ISO string
  settledAt: string | null; // ISO string
  bookmakerKey: string;
  odds: number;
  period: string;
};


export type UserBet = {
  betRef: string; 
  role: "creator" | "taker";
  createdAt: Timestamp;
};

export type Transaction = {
  id: string;
  userId: string;
  type: "deposit" | "withdrawal" | "bet_stake" | "bet_payout" | "commission";
  amount: number;
  status: "pending" | "completed" | "failed";
  relatedBetId?: string;
  gatewayTransactionId?: string;
  createdAt: string; // ISO string
};

export type Dispute = {
  id: string;
  betId: string;
  disputingUserId: string;
  reason: string;
  status: "open" | "under_review" | "resolved";
  resolution: {
    outcome: "creator_win" | "taker_win" | "void";
    adminNotes: string;
    resolvedAt: Timestamp;
  } | null;
  createdAt: Timestamp;
};
