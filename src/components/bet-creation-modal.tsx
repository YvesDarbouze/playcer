
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

const betSchema = z.discriminatedUnion("betType", [
    z.object({
        betType: z.literal("moneyline"),
        teamSelection: z.string().min(1, "Please select a team."),
        stake: z.coerce.number().min(1, "Stake must be at least $1."),
        opponentTwitter: z.string().optional(),
    }),
    z.object({
        betType: z.literal("spread"),
        teamSelection: z.string().min(1, "Please select a team."),
        stake: z.coerce.number().min(1, "Stake must be at least $1."),
        line: z.coerce.number({invalid_type_error: "A valid point spread is required."}),
        opponentTwitter: z.string().optional(),
    }),
    z.object({
        betType: z.literal("totals"),
        teamSelection: z.enum(["over", "under"], {errorMap: () => ({message: "Please select Over or Under."})}),
        stake: z.coerce.number().min(1, "Stake must be at least $1."),
        line: z.coerce.number({invalid_type_error: "A valid total is required."}),
        opponentTwitter: z.string().optional(),
    }),
]);


type BetFormData = z.infer<typeof betSchema>;

const TeamDisplay = ({ team }: { team: string }) => (
    <div className="text-center">
        <p className="font-bold text-lg">{team}</p>
    </div>
)

const OddsInfo = ({ label, value }: { label: string, value: string }) => (
    <div className="flex justify-between text-sm">
        <p className="text-muted-foreground">{label}</p>
        <p className="font-bold">{value}</p>
    </div>
);


export function BetCreationModal({ isOpen, onOpenChange, game, odds, loadingOdds }: BetCreationModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [betId, setBetId] = React.useState<string | null>(null);


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
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to create a bet.",
        variant: "destructive",
      });
      return;
    }
    setIsLoading(true);
    setIsSuccess(false);

    const functions = getFunctions(getFirebaseApp());
    const createBet = httpsCallable(functions, 'createBet');

    let betValue: any = {};
    
    switch(data.betType) {
        case 'moneyline':
            betValue = { team: data.teamSelection };
            break;
        case 'spread':
            betValue = { team: data.teamSelection, points: data.line };
            break;
        case 'totals':
            betValue = { over_under: data.teamSelection, total: data.line };
            break;
    }

    const betPayload = {
      gameId: game.id,
      gameDetails: {
          home_team: game.home_team,
          away_team: game.away_team,
          commence_time: game.commence_time,
          sport_key: game.sport_key,
      },
      wagerAmount: data.stake,
      betType: data.betType,
      betValue,
      recipientTwitterHandle: data.opponentTwitter,
      stripePaymentIntentId: 'temp_placeholder_id', // This would come from a payment flow
    };

    try {
      const result: any = await createBet(betPayload);

      if (result.data.success) {
        setIsSuccess(true);
        setBetId(result.data.betId);
        
        toast({
          title: "Challenge Created!",
          description: betPayload.recipientTwitterHandle 
            ? "Your tweet is ready to be sent." 
            : "Your public bet has been listed in the marketplace.",
        });
        
        if (betPayload.recipientTwitterHandle) {
            const betUrl = `${window.location.origin}/bet/${result.data.betId}`;
            const tweetText = encodeURIComponent(`.@${betPayload.recipientTwitterHandle} I challenge you to a bet on Playcer! ${game.away_team} @ ${game.home_team}`);
            const tweetUrl = `https://twitter.com/intent/tweet?text=${tweetText}&url=${betUrl}`;
            window.open(tweetUrl, '_blank');
        }
        
        onOpenChange(false);
      } else {
        throw new Error(result.data.error || "Failed to create bet.");
      }
    } catch (error: any) {
      console.error("Error creating bet:", error);
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleModalClose = (open: boolean) => {
    if (!open) {
        form.reset({ stake: 20, betType: "moneyline" });
        setIsSuccess(false);
    }
    onOpenChange(open);
  }
  
  const spreadMarket = odds?.markets.find(m => m.key === 'spreads');
  const totalsMarket = odds?.markets.find(m => m.key === 'totals');


  return (
    <Dialog open={isOpen} onOpenChange={handleModalClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-bold">Create Your Challenge</DialogTitle>
          <DialogDescription>
            Set the terms for your bet on this matchup.
          </DialogDescription>
        </DialogHeader>
        
        {isSuccess ? (
          <div className="space-y-4 py-8 text-center">
             <h3 className="font-bold text-lg">Challenge Sent!</h3>
             <p className="text-sm text-muted-foreground">
                {form.getValues("opponentTwitter") 
                    ? "Your challenge has been sent. Once they accept, the bet is on!"
                    : "Your public challenge is live in the marketplace for anyone to accept."}
            </p>
             <Button onClick={() => handleModalClose(false)} className="w-full">Done</Button>
          </div>
        ) : (
          <>
            <div className="my-4 p-4 bg-muted rounded-lg">
                <div className="grid grid-cols-3 items-center text-center">
                    <TeamDisplay team={game.home_team} />
                    <div className="flex flex-col items-center text-muted-foreground">
                        <Swords />
                        <span className="text-xs mt-1">vs</span>
                    </div>
                    <TeamDisplay team={game.away_team} />
                </div>
                {loadingOdds && <p className="text-center text-xs mt-2">Loading odds...</p>}
                {!loadingOdds && odds && (
                    <div className="mt-4 space-y-1 border-t pt-2">
                        {spreadMarket && <OddsInfo label="Point Spread" value={`${spreadMarket.outcomes[0].point} / ${spreadMarket.outcomes[1].point}`} />}
                        {totalsMarket && <OddsInfo label="Total (O/U)" value={`${totalsMarket.outcomes[0].point}`} />}
                    </div>
                )}
            </div>
          
            <Separator className="my-6" />

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                        control={form.control}
                        name="betType"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Bet Type</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a bet type" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="moneyline">Moneyline</SelectItem>
                                    <SelectItem value="spread">Point Spread</SelectItem>
                                    <SelectItem value="totals">Totals (Over/Under)</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                        )}
                    />

                    {(betType === 'spread' || betType === 'totals') && (
                         <FormField
                            control={form.control}
                            name="line"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>{betType === 'spread' ? 'Point Spread' : 'Total (Over/Under)'}</FormLabel>
                                <FormControl>
                                <Input type="number" step="0.5" placeholder={betType === 'spread' ? "-5.5" : "210.5"} {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                    )}
                    
                    <FormField
                        control={form.control}
                        name="teamSelection"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Your Pick</FormLabel>
                             <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select your team/side" />
                                    </Trigger>
                                </FormControl>
                                <SelectContent>
                                  {betType !== 'totals' && (
                                    <>
                                      <SelectItem value={game.home_team}>{game.home_team}</SelectItem>
                                      <SelectItem value={game.away_team}>{game.away_team}</SelectItem>
                                    </>
                                  )}
                                  {betType === 'totals' && <SelectItem value="over">Over</SelectItem>}
                                  {betType === 'totals' && <SelectItem value="under">Under</SelectItem>}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    
                    <div className="grid grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="stake"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Wager ($)</FormLabel>
                                <FormControl>
                                <Input type="number" placeholder="20.00" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="opponentTwitter"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Opponent (Optional)</FormLabel>
                                <FormControl>
                                    <div className="relative">
                                        <Twitter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input placeholder="@BenTheBettor" className="pl-9" {...field} />
                                    </div>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                    </div>
                    <DialogFooter className="pt-4">
                        <Button type="submit" disabled={isLoading} className="w-full" size="lg">
                            {isLoading ? <Loader2 className="animate-spin" /> : "Create Challenge"}
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
