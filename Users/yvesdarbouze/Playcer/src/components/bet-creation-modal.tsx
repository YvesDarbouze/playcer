
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
import type { Game } from "@/types";
import { Twitter, Swords, Loader2 } from "lucide-react";
import { getFirebaseApp } from "@/lib/firebase";
import { Separator } from "./ui/separator";
import { useStripe, useElements, PaymentElement, Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";


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
}

const betSchema = z.object({
    stake: z.coerce.number().min(1, "Stake must be at least $1."),
    opponentTwitter: z.string().optional().refine(val => !val || val.startsWith('@') || /^[a-zA-Z0-9_]{1,15}$/.test(val!), {
        message: "Invalid Twitter handle."
    }),
    betType: z.enum(["moneyline", "spread", "totals"]),
    line: z.coerce.number().optional(),
    teamSelection: z.string().optional(),
    overUnderSelection: z.string().optional(),
}).refine(data => {
    if (data.betType === 'spread') return !!data.teamSelection && data.line !== undefined;
    if (data.betType === 'totals') return !!data.overUnderSelection && data.line !== undefined;
    if (data.betType === 'moneyline') return !!data.teamSelection;
    return true;
}, {
    message: "Please complete all required fields for the selected bet type.",
    path: ["betType"],
});


type BetFormData = z.infer<typeof betSchema>;

const OddsInfo = ({ label, value }: { label: string, value: React.ReactNode }) => (
    <div className="flex justify-between items-center text-sm">
        <p className="text-muted-foreground">{label}</p>
        <p className="font-bold">{value}</p>
    </div>
);

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

function BetCreationModalInternal({ isOpen, onOpenChange, game, selectedBet }: BetCreationModalProps) {
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
    },
  });

  const opponentTwitter = form.watch("opponentTwitter");
  const stakeAmount = form.watch("stake") || 0;
  const betType = form.watch("betType");
  
  React.useEffect(() => {
    if (selectedBet) {
        form.setValue("betType", selectedBet.betType);
        if(selectedBet.betType === 'totals') {
            form.setValue("overUnderSelection", selectedBet.chosenOption);
        } else {
            form.setValue("teamSelection", selectedBet.chosenOption);
        }
        form.setValue("line", selectedBet.line);
    }
  }, [selectedBet, form]);


  const handleModalClose = (open: boolean) => {
    if (!open) {
        form.reset({ stake: 20, opponentTwitter: '' });
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

  const { odds, bookmakerKey } = selectedBet;

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
        const createBet = httpsCallable(functions, 'createBet');
        
        let betValue: any;
        if (data.betType === 'moneyline') {
            betValue = { team: data.teamSelection };
        } else if (data.betType === 'spread') {
            betValue = { team: data.teamSelection, points: data.line };
        } else { // totals
            betValue = { over_under: data.overUnderSelection, total: data.line };
        }

        const betPayload = {
          eventId: game.id,
          eventDate: game.commence_time,
          homeTeam: game.home_team,
          awayTeam: game.away_team,
          betType: data.betType,
          stakeAmount: data.stake,
          betValue,
          isPublic: !data.opponentTwitter,
          twitterShareUrl: data.opponentTwitter ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(`@${data.opponentTwitter.replace('@','')} I challenge you to a bet on Playcer!`)}` : null,
          bookmakerKey: bookmakerKey,
          odds: odds,
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

  const getBetValueDisplay = () => {
    const data = form.getValues();
    if (data.betType === 'moneyline') {
      return data.teamSelection;
    }
    if (data.betType === 'spread' && data.line !== undefined) {
      return `${data.teamSelection} ${data.line > 0 ? `+${data.line}` : data.line}`;
    }
    if (data.betType === 'totals' && data.line !== undefined) {
      return `Total ${data.overUnderSelection} ${data.line}`;
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
                            name="betType"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Bet Type</FormLabel>
                                    <Select onValueChange={(value) => field.onChange(value)} defaultValue={field.value}>
                                        <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="moneyline">Moneyline</SelectItem>
                                            <SelectItem value="spread">Point Spread</SelectItem>
                                            <SelectItem value="totals">Total (Over/Under)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )}
                        />

                        {betType === 'moneyline' && (
                             <FormField
                                control={form.control}
                                name="teamSelection"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Your Pick</FormLabel>
                                         <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value={game.home_team}>{game.home_team}</SelectItem>
                                                <SelectItem value={game.away_team}>{game.away_team}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage/>
                                    </FormItem>
                                )}/>
                        )}
                        
                        {betType === 'spread' && (
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="teamSelection"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Your Pick</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    <SelectItem value={game.home_team}>{game.home_team}</SelectItem>
                                                    <SelectItem value={game.away_team}>{game.away_team}</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage/>
                                        </FormItem>
                                    )}/>
                                <FormField
                                    control={form.control}
                                    name="line"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Custom Line</FormLabel>
                                            <FormControl><Input type="number" step="0.5" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl>
                                            <FormMessage/>
                                        </FormItem>
                                    )}
                                />
                            </div>
                        )}
                        
                        {betType === 'totals' && (
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="overUnderSelection"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Your Pick</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    <SelectItem value="Over">Over</SelectItem>
                                                    <SelectItem value="Under">Under</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage/>
                                        </FormItem>
                                    )}/>
                                <FormField
                                    control={form.control}
                                    name="line"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Custom Total</FormLabel>
                                            <FormControl><Input type="number" step="0.5" {...field} onChange={e => field.onChange(parseFloat(e.target.value))}/></FormControl>
                                            <FormMessage/>
                                        </FormItem>
                                    )}
                                />
                            </div>
                        )}


                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="stake" render={({ field }) => (
                                <FormItem><FormLabel>Wager ($)</FormLabel>
                                <FormControl><Input type="number" placeholder="20.00" {...field} /></FormControl>
                                <FormMessage /></FormItem>
                                )}
                            />
                             <FormField control={form.control} name="opponentTwitter" render={({ field }) => (
                                <FormItem><FormLabel>Opponent (Optional)</FormLabel>
                                <FormControl><div className="relative"><Twitter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="@handle or public" className="pl-9" {...field} /></div></FormControl>
                                <FormMessage /></FormItem>
                                )}
                            />
                        </div>

                         <div className="p-4 rounded-lg bg-muted text-sm space-y-1">
                            <OddsInfo label="Original Odds" value={odds > 0 ? `+${odds}`: odds} />
                            <OddsInfo label="Wager" value={`$${stakeAmount.toFixed(2)}`} />
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
