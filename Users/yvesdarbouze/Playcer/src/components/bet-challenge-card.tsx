
"use client";

import * as React from "react";
import { format } from "date-fns";
import { User as FirebaseUser } from "firebase/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Handshake, Share2, Swords, Twitter, Loader2 } from "lucide-react";
import type { Bet } from "@/types";
import { cn } from "@/lib/utils";
import { LoginButton } from "./login-button";
import { useToast } from "@/hooks/use-toast";
import { useStripe, useElements, PaymentElement } from "@stripe/react-stripe-js";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp } from "@/lib/firebase";
import { useRouter } from "next/navigation";


interface BetChallengeCardProps {
  bet: Bet;
  currentUser: FirebaseUser | null;
  onAccept: () => void;
  isAccepting: boolean;
  clientSecret: string | null;
}

const UserDisplay = ({
  username,
  photoURL,
}: {
  username?: string;
  photoURL?: string;
}) => (
  <div className="flex flex-col items-center gap-2">
    <Avatar className="size-16 border-2 border-primary">
      <AvatarImage src={photoURL} alt={username} />
      <AvatarFallback>{username ? username.charAt(0) : "?"}</AvatarFallback>
    </Avatar>
    <p className="font-bold">@{username || "???"}</p>
  </div>
);

const BetDetail = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex justify-between items-center text-sm">
        <p className="text-muted-foreground">{label}</p>
        <p className="font-bold">{value}</p>
    </div>
)

export function BetChallengeCard({
  bet,
  currentUser,
  onAccept,
  isAccepting,
  clientSecret,
}: BetChallengeCardProps) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const { toast } = useToast();
  const eventTime = new Date(bet.gameDetails.commence_time);
  const [isFinalizing, setIsFinalizing] = React.useState(false);

  const isChallenger = currentUser && currentUser.uid === bet.challengerId;
  const isRecipient = currentUser && currentUser.providerData[0]?.uid === bet.recipientTwitterHandle; // A simplification
  
  const canAccept = currentUser && bet.status === 'pending_acceptance' && !isChallenger;


  const handleShareBet = () => {
    const challengeLink = window.location.href;
    const tweetText = encodeURIComponent(`@${bet.recipientTwitterHandle} I challenge you to a bet on Playcer! ${bet.gameDetails.away_team} @ ${bet.gameDetails.home_team}`);
    const tweetUrl = `https://twitter.com/intent/tweet?text=${tweetText}&url=${challengeLink}`;
    window.open(tweetUrl, '_blank');
  };

  const getBetValueDisplay = () => {
      const { betValue, betType } = bet;
      if (betType === 'moneyline') {
          return `${betValue.team} to win`;
      }
      if (betType === 'spread') {
          return `${betValue.team} ${betValue.points! > 0 ? `+${betValue.points}` : betValue.points}`;
      }
      if (betType === 'totals') {
          return `Total ${betValue.over_under} ${betValue.total}`;
      }
      return '';
  }

  const handleFinalizeAcceptance = async () => {
      if (!stripe || !elements || !clientSecret) {
          toast({ title: "Error", description: "Stripe is not ready.", variant: "destructive" });
          return;
      }
      setIsFinalizing(true);
      
      const { error, paymentIntent } = await stripe.confirmPayment({
          elements,
          redirect: 'if_required'
      });
      
      if (error) {
          toast({ title: "Payment Failed", description: error.message, variant: "destructive" });
          setIsFinalizing(false);
          return;
      }
      
      // The backend webhook will handle the rest. We just give feedback to the user.
      if (paymentIntent && paymentIntent.status === 'requires_capture') {
           toast({
              title: "Challenge Accepted!",
              description: "The bet is now active. Good luck!",
            });
           router.push('/dashboard');
      } else {
          toast({ title: "Authorization Failed", description: "Your card could not be authorized.", variant: "destructive"});
      }

      setIsFinalizing(false);
  }

  const renderActionButton = () => {
    if (clientSecret) {
        return (
            <div className="w-full space-y-4">
                <h3 className="text-center font-bold">Authorize Payment to Accept</h3>
                <PaymentElement />
                <Button onClick={handleFinalizeAcceptance} disabled={isFinalizing || !stripe} className="w-full">
                    {isFinalizing ? <Loader2 className="animate-spin" /> : "Confirm & Accept Bet"}
                </Button>
            </div>
        )
    }
    if (!currentUser) {
        return <div className="flex flex-col gap-2 items-center">
            <p className="text-sm text-muted-foreground">You must be logged in to participate.</p>
            <LoginButton />
        </div>
    }
    if (canAccept) {
      return (
        <Button onClick={onAccept} disabled={isAccepting} className="w-full" size="lg">
          {isAccepting ? <Loader2 className="animate-spin mr-2" /> : <Handshake className="mr-2" />}
          {isAccepting ? "Initializing..." : "Accept Challenge"}
        </Button>
      );
    }
    if (isChallenger && bet.status === 'pending_acceptance') {
      return (
        <Button onClick={handleShareBet} className="w-full" size="lg" variant="secondary">
          <Twitter className="mr-2" />
          Tweet Challenge Again
        </Button>
      );
    }
    if (bet.status === 'active') {
         return <Badge className="text-lg" variant="default">Bet is Active!</Badge>
    }
    if (bet.status === 'completed') {
         return <Badge className="text-lg" variant="secondary">Bet Completed</Badge>
    }
    return null; 
  };

  return (
    <Card className="w-full max-w-2xl shadow-2xl">
      <CardHeader className="text-center bg-muted/30 p-4">
        <Badge variant={bet.status === 'pending_acceptance' ? 'default' : 'secondary'} className="mx-auto w-fit mb-2">
            {bet.status.replace(/_/g, ' ').toUpperCase()}
        </Badge>
        <CardTitle className="font-bold text-lg">
            {bet.gameDetails.away_team} @ {bet.gameDetails.home_team}
        </CardTitle>
        <CardDescription>
            {format(eventTime, "EEE, MMM d, yyyy 'at' h:mm a")}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6">
       <div className={cn(clientSecret && "hidden")}>
            <div className="grid grid-cols-3 items-center text-center mb-6">
                <UserDisplay username={bet.creatorUsername} photoURL={bet.creatorPhotoURL}/>
                <div className="flex flex-col items-center">
                    <Swords className="text-muted-foreground my-2 size-8" />
                    <span className="font-bold text-xl">${bet.wagerAmount.toFixed(2)}</span>
                </div>
                <UserDisplay username={bet.recipientUsername || bet.recipientTwitterHandle} photoURL={bet.recipientPhotoURL}/>
            </div>

            <Separator className="my-4" />

            <div className="space-y-2">
                <BetDetail label="Challenger's Pick" value={getBetValueDisplay()} />
                <BetDetail label="Wager" value={`$${bet.wagerAmount.toFixed(2)}`} />
                <BetDetail label="Potential Payout" value={`$${(bet.wagerAmount * 2).toFixed(2)}`} />
            </div>
       </div>
      </CardContent>
      <CardFooter className="p-4 bg-muted/30">
        {renderActionButton()}
      </CardFooter>
    </Card>
  );
}
