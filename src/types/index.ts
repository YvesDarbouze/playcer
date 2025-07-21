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
  createdAt: Timestamp;
  walletBalance: number;
  wins: number;
  losses: number;
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
  line: number | null;
  odds: number;
  teamSelection: string;
  stake: number;
  status: 'open' | 'matched' | 'settled' | 'void';
  winnerId: string | null;
  createdAt: Timestamp; 
  uniqueLink: string;
};
