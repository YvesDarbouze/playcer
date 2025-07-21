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
