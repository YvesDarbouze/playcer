
"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { getFunctions, httpsCallable } from "firebase/functions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import type { Game, User } from "@/types";
import { Twitter, Swords, Loader2 } from "lucide-react";
import { getFirebaseApp } from "@/lib/firebase";
import { Separator } from "./ui/separator";
import { useStripe, useElements, PaymentElement, Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";


type SelectedBet = {
    betType: "moneyline" | "spread" | "totals";
    chosenOption: string;
    line?: number;
    odds: number;
    bookmakerKey: string;
}

interface BetCreationModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  game: Game;
  selectedBet: SelectedBet | null;
  userProfile: User | null;
}

const createBetSchema = (walletBalance: number = 0) => z.object({
    stakeAmount: z.coerce
        .number()
        .min(1, "Stake must be at least $1.")
        .max(10000, "Stake cannot exceed $10,000.")
        .refine(val => val <= walletBalance, {
            message: "Wager cannot exceed your available wallet balance."
        }),
    betVisibility: z.enum(["public", "private"]).default("public"),
    opponentTwitter: z.string().optional().refine(val => !val || val.startsWith('@') || /^[a-zA-Z0-9_]{1,15}$/.test(val!), {
        message: "Invalid Twitter handle."
    }),
}).refine(data => {
    if (data.betVisibility === 'private') {
        return !!data.opponentTwitter && data.opponentTwitter.length > 1;
    }
    return true;
}, {
    message: "A Twitter handle is required for a private challenge.",
    path: ["opponentTwitter"],
});


type BetFormData = z.infer<ReturnType<typeof createBetSchema>>;

const OddsInfo = ({ label, value }: { label: string, value: React.ReactNode }) => (
    <div className="flex justify-between items-center text-sm">
        <p className="text-muted-foreground">{label}</p>
        <p className="font-bold">{value}</p>
    </div>
);

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

function BetCreationModalInternal({ isOpen, onOpenChange, game, selectedBet, userProfile }: BetCreationModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const stripe = useStripe();
  const elements = useElements();

  const [isLoading, setIsLoading] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [betId, setBetId] = React.useState<string | null>(null);
  const [step, setStep] = React.useState(1);
  const [clientSecret, setClientSecret] = React.useState<string | null>(null);
  
  const form = useForm<BetFormData>({
    resolver: zodResolver(createBetSchema(userProfile?.walletBalance)),
    defaultValues: {
      stakeAmount: 20,
      betVisibility: "public",
    },
  });

  const betVisibility = form.watch("betVisibility");
  const opponentTwitter = form.watch("opponentTwitter");
  const stakeAmount = form.watch("stakeAmount") || 0;
  
  const handleModalClose = (open: boolean) => {
    if (!open) {
        form.reset({ stakeAmount: 20, opponentTwitter: '', betVisibility: 'public' });
        setIsSuccess(false);
        setStep(1);
        setClientSecret(null);
    }
    onOpenChange(open);
  }
  
  if (!selectedBet) {
      if (isOpen) handleModalClose(false);
      return null;
  }

  const { odds, bookmakerKey, chosenOption, line, betType } = selectedBet;

  const onSubmit = async (data: BetFormData) => {
    if (!user) return toast({ title: "Not Authenticated", variant: "destructive" });
    if (!stripe || !elements) return toast({ title: "Stripe not ready", variant: "destructive" });
    
    setIsLoading(true);

    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    });

    if (confirmError) {
      toast({ title: "Payment Failed", description: confirmError.message, variant: "destructive" });
      setIsLoading(false);
      return;
    }

    if (paymentIntent && paymentIntent.status === 'requires_capture') {
        const functions = getFunctions(getFirebaseApp());
        const createBetFn = httpsCallable(functions, 'createBet');
        
        const betPayload = {
          eventId: game.id,
          eventDate: game.commence_time,
          homeTeam: game.home_team,
          awayTeam: game.away_team,
          betType,
          stakeAmount: data.stakeAmount,
          chosenOption,
          line,
          isPublic: data.betVisibility === 'public',
          twitterShareUrl: data.betVisibility === 'private' && data.opponentTwitter 
            ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(`@${data.opponentTwitter.replace('@','')} I challenge you to a bet on Playcer!`)}` 
            : null,
          bookmakerKey: bookmakerKey,
          odds: odds,
        };

        try {
          const result: any = await createBetFn(betPayload);
          if (result.data.success) {
            setIsSuccess(true);
            setBetId(result.data.betId);
            setStep(3); // Move to success step
          } else {
            throw new Error(result.data.error || "Failed to create bet.");
          }
        } catch (error: any) {
          toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    } else {
      toast({ title: "Authorization Failed", description: "Your card could not be authorized.", variant: "destructive"});
    }
    setIsLoading(false);
  };

  const handleNextToPayment = async () => {
      const isValid = await form.trigger();
      if (!isValid) return;
      
      setIsLoading(true);
      const functions = getFunctions(getFirebaseApp());
      const createBetPaymentIntent = httpsCallable(functions, 'createBetPaymentIntent');
      
      try {
          const result: any = await createBetPaymentIntent({ wagerAmount: form.getValues("stakeAmount") });
          if(result.data.success) {
              setClientSecret(result.data.clientSecret);
              setStep(2);
          } else {
              throw new Error(result.data.message || "Could not initialize payment.");
          }
      } catch (error: any) {
           toast({ title: "Error", description: error.message, variant: "destructive" });
      } finally {
          setIsLoading(false);
      }
  }

  const getBetValueDisplay = () => {
    if (betType === 'moneyline') {
      return chosenOption;
    }
    if (betType === 'spread') {
      return `${chosenOption} ${line! > 0 ? `+${line}` : line}`;
    }
    if (betType === 'totals') {
      return `Total ${chosenOption} ${line}`;
    }
    return '';
  }
  
  const potentialWinnings = (stakeAmount * (odds > 0 ? (odds / 100) : (100 / Math.abs(odds)))).toFixed(2);
  const potentialPayout = (stakeAmount + parseFloat(potentialWinnings)).toFixed(2);


  const renderStepContent = () => {
      switch(step) {
          case 1:
              return (
                <Form {...form}>
                    <form id="bet-details-form" className="space-y-4">
                        <FormField
                            control={form.control}
                            name="stakeAmount"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Wager Amount ($)</FormLabel>
                                    <FormControl><Input type="number" placeholder="20.00" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="betVisibility"
                            render={({ field }) => (
                                <FormItem className="space-y-3">
                                <FormLabel>Challenge Type</FormLabel>
                                <FormControl>
                                    <RadioGroup
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                    className="flex space-x-4"
                                    >
                                    <FormItem className="flex items-center space-x-2 space-y-0">
                                        <FormControl>
                                        <RadioGroupItem value="public" />
                                        </FormControl>
                                        <FormLabel className="font-normal">
                                        List on Marketplace (Public)
                                        </FormLabel>
                                    </FormItem>
                                    <FormItem className="flex items-center space-x-2 space-y-0">
                                        <FormControl>
                                        <RadioGroupItem value="private" />
                                        </FormControl>
                                        <FormLabel className="font-normal">
                                        Direct Challenge (Private)
                                        </FormLabel>
                                    </FormItem>
                                    </RadioGroup>
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                        
                        {betVisibility === 'private' && (
                             <FormField control={form.control} name="opponentTwitter" render={({ field }) => (
                                <FormItem><FormLabel>Opponent's Twitter Handle</FormLabel>
                                <FormControl><div className="relative"><Twitter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="@handle" className="pl-9" {...field} /></div></FormControl>
                                <FormMessage /></FormItem>
                                )}
                            />
                        )}

                         <div className="p-4 rounded-lg bg-muted text-sm space-y-1">
                            <h4 className="font-bold">Your Pick: {getBetValueDisplay()}</h4>
                            <OddsInfo label="Odds" value={odds > 0 ? `+${odds}`: odds} />
                            <OddsInfo label="Potential Winnings" value={`$${potentialWinnings}`} />
                            <Separator />
                            <OddsInfo label="Total Payout" value={`$${potentialPayout}`} />
                         </div>

                    </form>
                    <DialogFooter className="pt-4">
                        <Button onClick={handleNextToPayment} disabled={isLoading} className="w-full" size="lg">{isLoading ? <Loader2 className="animate-spin" /> : "Next"}</Button>
                    </DialogFooter>
                </Form>
              );
            case 2:
              return (
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <h3 className="font-bold">Authorize Payment</h3>
                      <p className="text-sm text-muted-foreground">Confirm your payment method. This is a temporary hold; your card is only charged if the bet is accepted and you lose.</p>
                      <PaymentElement />
                      <DialogFooter className="pt-4 flex justify-between w-full">
                           <Button type="button" variant="ghost" onClick={() => setStep(1)}>Back</Button>
                           <Button type="submit" disabled={isLoading || !stripe} size="lg">{isLoading ? <Loader2 className="animate-spin" /> : "Create Challenge"}</Button>
                      </DialogFooter>
                  </form>
              );
            case 3:
                const tweetUrl = opponentTwitter 
                    ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(`@${opponentTwitter.replace('@','')} I challenge you on Playcer: ${getBetValueDisplay()} for $${stakeAmount.toFixed(2)} in the ${game.away_team} @ ${game.home_team} game!`)}&url=${window.location.origin}/bet/${betId}`
                    : `https://twitter.com/intent/tweet?text=${encodeURIComponent(`I just posted a public challenge on Playcer: ${getBetValueDisplay()} for $${stakeAmount.toFixed(2)} in the ${game.away_team} @ ${game.home_team} game. Who wants to accept?`)}&url=${window.location.origin}/bet/${betId}`;

                return (
                    <div className="space-y-4 py-8 text-center">
                         <h3 className="font-bold text-lg">Challenge Created!</h3>
                         <p className="text-sm text-muted-foreground">
                            {opponentTwitter
                                ? "Your challenge has been created. Share it with your opponent so they can accept!"
                                : "Your public bet is live in the marketplace! Share it with your followers."
                            }
                         </p>
                         <Button asChild className="w-full" variant="outline">
                            <a href={tweetUrl} target="_blank" rel="noopener noreferrer"><Twitter className="mr-2"/>Share on Twitter</a>
                         </Button>
                         <Button onClick={() => handleModalClose(false)} className="w-full">Done</Button>
                    </div>
                );
      }
  }


  return (
    <Dialog open={isOpen} onOpenChange={handleModalClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-bold text-center text-2xl">Place Your Bet</DialogTitle>
           <DialogDescription className="text-center">
            {game.away_team} @ {game.home_team}
          </DialogDescription>
        </DialogHeader>
        <Separator />
        {step === 2 && clientSecret ? (
            <Elements stripe={stripePromise} options={{clientSecret}}>
                {renderStepContent()}
            </Elements>
        ) : (
            renderStepContent()
        )}
      </DialogContent>
    </Dialog>
  );
}


export function BetCreationModal(props: BetCreationModalProps) {
    if (!props.isOpen) {
        return null;
    }
    
    return (
        <Elements stripe={stripePromise} options={{}}>
            <BetCreationModalInternal {...props} />
        </Elements>
    )
}
