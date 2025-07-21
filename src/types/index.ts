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
  uid: string;
  twitterId: string;
  displayName: string;
  username: string;
  photoURL: string;
  createdAt: Timestamp;
  walletBalance: number;
  wins: number;
  losses: number;
};

export type Bet = {
  id: string; // Auto-generated
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
  line: number;
  odds: number;
  teamSelection: string;
  stake: number;
  status: 'open' | 'matched' | 'settled' | 'void';
  winnerId: string | null;
  createdAt: Timestamp;
  uniqueLink: string;
};
