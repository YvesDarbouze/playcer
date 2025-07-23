

"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { getFirestore, doc, getDoc, Timestamp } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { useAuth } from "@/hooks/use-auth";
import type { Bet } from "@/types";
import { getFirebaseApp } from "@/lib/firebase";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { BetChallengeCard } from "@/components/bet-challenge-card";

// Helper function to convert Firestore data to Bet type
const convertToBet = (docSnap: any): Bet => {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    ...data,
    gameDetails: {
      ...data.gameDetails,
      commence_time: (data.gameDetails.commence_time as Timestamp).toDate(),
    },
    createdAt: (data.createdAt as Timestamp).toDate(),
    settledAt: data.settledAt ? (data.settledAt as Timestamp).toDate() : null,
  } as Bet;
}


export default function BetChallengePage() {
  const params = useParams();
  const router = useRouter();
  const { betId } = params;
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [bet, setBet] = React.useState<Bet | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isAccepting, setIsAccepting] = React.useState(false);

  const fetchBet = React.useCallback(async () => {
      if (typeof betId !== "string") return;
      setLoading(true);
      setError(null);
      try {
        const db = getFirestore(getFirebaseApp());
        const betRef = doc(db, "bets", betId);
        const betSnap = await getDoc(betRef);

        if (betSnap.exists()) {
          setBet(convertToBet(betSnap));
        } else {
          setError("Bet not found.");
        }
      } catch (err) {
        console.error("Error fetching bet:", err);
        setError("Failed to load bet details.");
      } finally {
        setLoading(false);
      }
    }, [betId]);

  React.useEffect(() => {
    fetchBet();
  }, [fetchBet]);

  const handleAcceptBet = async () => {
    if (!user || !bet) return;
    setIsAccepting(true);

    const functions = getFunctions(getFirebaseApp());
    const acceptBetFn = httpsCallable(functions, "acceptBet");

    try {
      const result: any = await acceptBetFn({ betId: bet.id });
      if (result.data.success) {
        toast({
          title: "Challenge Accepted!",
          description: "The bet is now active. Good luck!",
        });
        // Redirect to dashboard after accepting
        router.push('/dashboard');
      } else {
        throw new Error(result.data.message || "Failed to accept bet.");
      }
    } catch (err: any) {
      console.error("Error accepting bet:", err);
      toast({
        title: "Error",
        description: err.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsAccepting(false);
    }
  };

  const renderContent = () => {
    if (loading || authLoading) {
      return (
        <div className="w-full max-w-2xl">
          <Skeleton className="h-[400px] w-full rounded-lg" />
        </div>
      );
    }

    if (error) {
      return <p className="text-destructive">{error}</p>;
    }

    if (bet) {
      return (
        <BetChallengeCard
          bet={bet}
          currentUser={user}
          onAccept={handleAcceptBet}
          isAccepting={isAccepting}
        />
      );
    }

    return null;
  };

  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center p-4 bg-muted/40">
        {renderContent()}
    </main>
  );
}
