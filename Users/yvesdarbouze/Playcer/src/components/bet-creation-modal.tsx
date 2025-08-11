
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import type { Game } from "@/types";
import { Twitter, Swords, Loader2 } from "lucide-react";
import { getFirebaseApp } from "@/lib/firebase";
import { Separator } from "./ui/separator";
import Image from "next/image";
import { getTeamLogoUrl } from "@/lib/team-logo-helper";
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';


interface BookmakerOdds {
    key: string;
    title: string;
    last_update: string;
    markets: {
        key: "h2h" | "spreads" | "totals";
        outcomes: { name: string; price: number, point?: number }[];
    }[];
};

interface BetCreationModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  game: Game;
  odds: BookmakerOdds | null;
  loadingOdds: boolean;
}

const betSchema = z.object({
    betType: z.enum(["moneyline", "spread", "totals"]),
    teamSelection: z.string().min(1, "Please select a team or option."),
    stake: z.coerce.number().min(1, "Stake must be at least $1."),
    line: z.coerce.number().optional(),
    opponentTwitter: z.string().min(1, "An opponent's Twitter handle is required.").startsWith("@", "Twitter handle must start with @"),
}).refine((data) => {
    if (data.betType === 'spread' || data.betType === 'totals') {
        return data.line !== undefined && data.line !== null;
    }
    return true;
}, {
    message: "Line is required for spread and total bets.",
    path: ["line"],
});


type BetFormData = z.infer<typeof betSchema>;

const TeamDisplay = ({ team, logoUrl }: { team: string, logoUrl: string }) => (
    <div className="text-center flex flex-col items-center gap-2">
        <Image src={logoUrl} alt={`${team} logo`} width={48} height={48} className="h-12 w-auto" />
        <p className="font-bold text-lg">{team}</p>
    </div>
)

const OddsInfo = ({ label, value }: { label: string, value: string }) => (
    <div className="flex justify-between text-sm">
        <p className="text-muted-foreground">{label}</p>
        <p className="font-bold">{value}</p>
    </div>
);

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

function BetCreationModalInternal({ isOpen, onOpenChange, game, odds, loadingOdds }: BetCreationModalProps) {
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
    resolver: zodResolver(betSchema),
    defaultValues: {
      stake: 20,
      betType: "moneyline",
    },
  });

  const betType = form.watch("betType");
  
  React.useEffect(() => {
    form.clearErrors();
    const spreadMarket = odds?.markets.find(m => m.key === 'spreads');
    const totalsMarket = odds?.markets.find(m => m.key === 'totals');

    if (betType === 'spread' && spreadMarket) {
        form.setValue('line', spreadMarket.outcomes[0].point);
    } else if (betType === 'totals' && totalsMarket) {
        form.setValue('line', totalsMarket.outcomes[0].point);
    }
  }, [betType, odds, form]);


  const onSubmit = async (data: BetFormData) => {
    if (!user) return toast({ title: "Not Authenticated", variant: "destructive" });
    if (!stripe || !elements) return toast({ title: "Stripe not ready", variant: "destructive" });
    
    setIsLoading(true);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    });

    if (error) {
      toast({ title: "Payment Failed", description: error.message, variant: "destructive" });
      setIsLoading(false);
      return;
    }

    if (paymentIntent && paymentIntent.status === 'requires_capture') {
        const functions = getFunctions(getFirebaseApp());
        const createBet = httpsCallable(functions, 'createBet');

        let betValue: any = {};
        switch(data.betType) {
            case 'moneyline': betValue = { team: data.teamSelection }; break;
            case 'spread': betValue = { team: data.teamSelection, points: data.line }; break;
            case 'totals': betValue = { over_under: data.teamSelection, total: data.line }; break;
        }

        const betPayload = {
          gameId: game.id,
          gameDetails: { home_team: game.home_team, away_team: game.away_team, commence_time: game.commence_time, sport_key: game.sport_key },
          wagerAmount: data.stake,
          betType: data.betType,
          betValue,
          recipientTwitterHandle: data.opponentTwitter,
          stripePaymentIntentId: paymentIntent.id,
        };

        try {
          const result: any = await createBet(betPayload);
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
          const result: any = await createBetPaymentIntent({ wagerAmount: form.getValues("stake") });
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
  
  const handleModalClose = (open: boolean) => {
    if (!open) {
        form.reset({ stake: 20, betType: "moneyline" });
        setIsSuccess(false);
        setStep(1);
        setClientSecret(null);
    }
    onOpenChange(open);
  }
  
  const spreadMarket = odds?.markets.find(m => m.key === 'spreads');
  const totalsMarket = odds?.markets.find(m => m.key === 'totals');

  const homeLogo = getTeamLogoUrl(game.home_team, game.sport_key);
  const awayLogo = getTeamLogoUrl(game.away_team, game.sport_key);

  const renderStepContent = () => {
      switch(step) {
          case 1:
              return (
                <Form {...form}>
                    <form id="bet-details-form" className="space-y-4">
                        <FormField
                            control={form.control}
                            name="betType"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Bet Type</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger><SelectValue placeholder="Select a bet type" /></SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="moneyline">Moneyline</SelectItem>
                                        <SelectItem value="spread" disabled={!spreadMarket}>Point Spread</SelectItem>
                                        <SelectItem value="totals" disabled={!totalsMarket}>Totals (O/U)</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                            )}
                        />

                        {(betType === 'spread' || betType === 'totals') && (
                             <FormField control={form.control} name="line" render={({ field }) => (
                                <FormItem><FormLabel>{betType === 'spread' ? 'Point Spread' : 'Total (O/U)'}</FormLabel>
                                <FormControl><Input type="number" step="0.5" {...field} /></FormControl>
                                <FormMessage /></FormItem>
                                )}
                            />
                        )}
                        
                        <FormField control={form.control} name="teamSelection" render={({ field }) => (
                            <FormItem><FormLabel>Your Pick</FormLabel>
                                 <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Select your team/side" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                      {betType !== 'totals' && (<><SelectItem value={game.home_team}>{game.home_team}</SelectItem><SelectItem value={game.away_team}>{game.away_team}</SelectItem></>)}
                                      {betType === 'totals' && <><SelectItem value="over">Over</SelectItem><SelectItem value="under">Under</SelectItem></>}
                                    </SelectContent>
                                </Select><FormMessage />
                            </FormItem>)}
                        />
                        
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="stake" render={({ field }) => (
                                <FormItem><FormLabel>Wager ($)</FormLabel>
                                <FormControl><Input type="number" placeholder="20.00" {...field} /></FormControl>
                                <FormMessage /></FormItem>
                                )}
                            />
                             <FormField control={form.control} name="opponentTwitter" render={({ field }) => (
                                <FormItem><FormLabel>Opponent's Twitter</FormLabel>
                                <FormControl><div className="relative"><Twitter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="@BenTheBettor" className="pl-9" {...field} /></div></FormControl>
                                <FormMessage /></FormItem>
                                )}
                            />
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
                      <p className="text-sm text-muted-foreground">Confirm your payment method to place the bet. This is a temporary hold; you are only charged if you lose.</p>
                      <PaymentElement />
                      <DialogFooter className="pt-4">
                           <Button type="button" variant="ghost" onClick={() => setStep(1)}>Back</Button>
                           <Button type="submit" disabled={isLoading || !stripe} className="w-full" size="lg">{isLoading ? <Loader2 className="animate-spin" /> : "Create Challenge"}</Button>
                      </DialogFooter>
                  </form>
              );
            case 3:
                return (
                    <div className="space-y-4 py-8 text-center">
                         <h3 className="font-bold text-lg">Challenge Sent!</h3>
                         <p className="text-sm text-muted-foreground">Your challenge has been created. Once your opponent accepts, the bet is on!</p>
                         <Button onClick={() => {
                             const betUrl = `${window.location.origin}/bet/${betId}`;
                             const tweetText = encodeURIComponent(`I challenge ${form.getValues("opponentTwitter")} to a bet on Playcer! ${game.away_team} @ ${game.home_team}`);
                             const tweetUrl = `https://twitter.com/intent/tweet?text=${tweetText}&url=${betUrl}`;
                             window.open(tweetUrl, '_blank');
                         }} className="w-full" variant="outline"><Twitter className="mr-2"/>Tweet Challenge</Button>
                         <Button onClick={() => handleModalClose(false)} className="w-full">Done</Button>
                    </div>
                );
      }
  }


  return (
    <Dialog open={isOpen} onOpenChange={handleModalClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-bold">Create Your Challenge</DialogTitle>
          <DialogDescription>Set the terms for your bet on this matchup.</DialogDescription>
        </DialogHeader>
        <div className="my-4 p-4 bg-muted rounded-lg">
            <div className="grid grid-cols-2 items-center text-center">
                <TeamDisplay team={game.away_team} logoUrl={awayLogo} />
                <TeamDisplay team={game.home_team} logoUrl={homeLogo} />
            </div>
            {loadingOdds ? <p className="text-center text-xs mt-2">Loading odds...</p> : odds && (
                <div className="mt-4 space-y-1 border-t pt-2">
                    {spreadMarket && <OddsInfo label="Point Spread" value={`${spreadMarket.outcomes[0].point} / ${spreadMarket.outcomes[1].point}`} />}
                    {totalsMarket && <OddsInfo label="Total (O/U)" value={`${totalsMarket.outcomes[0].point}`} />}
                </div>
            )}
        </div>
        <Separator className="my-6" />
        {renderStepContent()}
      </DialogContent>
    </Dialog>
  );
}

export function BetCreationModal(props: BetCreationModalProps) {
    return (
        <Elements stripe={stripePromise} options={{}}>
            <BetCreationModalInternal {...props} />
        </Elements>
    )
}

    