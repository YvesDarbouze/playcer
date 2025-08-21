
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
import { Handshake, Swords, Twitter, Loader2, LogIn } from "lucide-react";
import type { Bet } from "@/types";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useStripe, useElements, PaymentElement } from "@stripe/react-stripe-js";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "./ui/input";
import { Label } from "./ui/label";


interface BetChallengeCardProps {
  bet: Bet;
  currentUser: FirebaseUser | null;
  onAccept: (acceptedAmount: number) => void;
  isAccepting: boolean;
  clientSecret: string | null;
}

const UserDisplay = ({
  username,
  photoURL,
}: {
  username?: string | null;
  photoURL?: string | null;
}) => (
  <div className="flex flex-col items-center gap-2">
    <Avatar className="size-16 border-2 border-primary">
      <AvatarImage src={photoURL || undefined} alt={username || ''} />
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
  const { signIn } = useAuth();
  const [isFinalizing, setIsFinalizing] = React.useState(false);
  const [acceptedAmount, setAcceptedAmount] = React.useState(bet.remainingWager || bet.totalWager);

  const isCreator = currentUser && currentUser.uid === bet.challengerId;
  const canAccept = currentUser && bet.status === 'pending' && !isCreator;

  const handleShareBet = () => {
    const shareUrl = bet.twitterShareUrl || `https://twitter.com/intent/tweet?text=${encodeURIComponent(`I just posted a public challenge on Playcer for ${bet.awayTeam} @ ${bet.homeTeam}. Who wants to accept?`)}&url=${window.location.href}`;
    window.open(shareUrl, '_blank');
  };

  const getBetValueDisplay = () => {
    const { chosenOption, betType, line } = bet;
    if (betType === 'moneyline') {
      return chosenOption;
    }
    if (betType === 'spread') {
      return `${chosenOption} ${line! > 0 ? `+${line}` : line}`;
    }
    if (betType === 'totals') {
      return `Total ${chosenOption} ${line}`;
    }
    return chosenOption;
  }
  
  const potentialWinnings = (acceptedAmount * (bet.odds > 0 ? (bet.odds / 100) : (100 / Math.abs(bet.odds)))).toFixed(2);
  const potentialPayout = (acceptedAmount + parseFloat(potentialWinnings)).toFixed(2);

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
      
      if (paymentIntent && (paymentIntent.status === 'requires_capture' || paymentIntent.status === 'succeeded')) {
           toast({
              title: "Challenge Accepted!",
              description: "The bet is now active. Good luck!",
            });
           router.push('/dashboard');
      } else {
          toast({ title: "Authorization Pending", description: "Your payment authorization is processing. The bet will activate once confirmed.", variant: "default"});
          router.push('/dashboard');
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
                    {isFinalizing ? <Loader2 className="animate-spin" /> : `Confirm & Accept Bet for $${acceptedAmount.toFixed(2)}`}
                </Button>
            </div>
        )
    }
     if (!currentUser && bet.status === 'pending') {
        return (
            <Button onClick={signIn} className="w-full" size="lg">
                <LogIn className="mr-2" />
                Login to Accept
            </Button>
        );
    }
    if (canAccept) {
        if (bet.allowFractionalAcceptance) {
            return (
                <div className="w-full space-y-4">
                    <div className="space-y-1">
                        <Label htmlFor="accept-amount">Accept Amount</Label>
                        <Input
                            id="accept-amount"
                            type="number"
                            value={acceptedAmount}
                            onChange={(e) => setAcceptedAmount(Number(e.target.value))}
                            max={bet.remainingWager}
                            min="1"
                            step="1"
                        />
                         <p className="text-xs text-muted-foreground">
                            Up to ${bet.remainingWager?.toFixed(2)} remaining.
                        </p>
                    </div>
                    <Button onClick={() => onAccept(acceptedAmount)} disabled={isAccepting || acceptedAmount <= 0 || acceptedAmount > bet.remainingWager} className="w-full" size="lg">
                        {isAccepting ? <Loader2 className="animate-spin mr-2" /> : <Handshake className="mr-2" />}
                        {isAccepting ? "Initializing..." : `Accept $${acceptedAmount.toFixed(2)}`}
                    </Button>
                </div>
            )
        }
      return (
        <Button onClick={() => onAccept(bet.totalWager)} disabled={isAccepting} className="w-full" size="lg">
          {isAccepting ? <Loader2 className="animate-spin mr-2" /> : <Handshake className="mr-2" />}
          {isAccepting ? "Initializing..." : "Accept Challenge"}
        </Button>
      );
    }
    if (isCreator && bet.status === 'pending') {
      return (
        <Button onClick={handleShareBet} className="w-full" size="lg" variant="secondary">
          <Twitter className="mr-2" />
          Share Challenge
        </Button>
      );
    }
    if (bet.status === 'active') {
         return <Badge className="text-lg" variant="default">Bet is Active!</Badge>
    }
    if (bet.status === 'settled') {
         return <Badge className="text-lg" variant="secondary">Bet Settled</Badge>
    }
    return null; 
  };

  const accepter = bet.accepters && bet.accepters.length > 0 ? bet.accepters[0] : null;

  return (
    <Card className="w-full max-w-2xl shadow-2xl">
      <CardHeader className="text-center bg-muted/30 p-4">
        <Badge variant={bet.status === 'pending' ? 'default' : 'secondary'} className="mx-auto w-fit mb-2">
            {bet.status.replace(/_/g, ' ').toUpperCase()}
        </Badge>
        <CardTitle className="font-bold text-lg">
            {bet.awayTeam} @ {bet.homeTeam}
        </CardTitle>
        <CardDescription>
            {format(new Date(bet.eventDate), "EEEE, MMM d, yyyy 'at' h:mm a")}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6">
       <div className={cn(clientSecret && "hidden")}>
            <div className="grid grid-cols-3 items-center text-center mb-6">
                <UserDisplay username={bet.challengerUsername} photoURL={bet.challengerPhotoURL}/>
                <div className="flex flex-col items-center">
                    <Swords className="text-muted-foreground my-2 size-8" />
                    <span className="font-bold text-xl">${bet.totalWager.toFixed(2)}</span>
                    {bet.allowFractionalAcceptance && bet.remainingWager && (
                         <span className="text-xs text-muted-foreground">
                            (${bet.remainingWager.toFixed(2)} left)
                        </span>
                    )}
                </div>
                <UserDisplay username={accepter?.accepterUsername} photoURL={accepter?.accepterPhotoURL}/>
            </div>

            <Separator className="my-4" />

            <div className="space-y-2">
                <BetDetail label="Challenger's Pick" value={getBetValueDisplay()} />
                <BetDetail label="Odds" value={bet.odds > 0 ? `+${bet.odds}`: bet.odds} />
                <BetDetail label="Potential Winnings" value={`$${potentialWinnings}`} />
                <Separator />
                <BetDetail label="Total Payout" value={`$${potentialPayout}`} />
            </div>
       </div>
      </CardContent>
      <CardFooter className="p-4 bg-muted/30">
        {renderActionButton()}
      </CardFooter>
    </Card>
  );
}
