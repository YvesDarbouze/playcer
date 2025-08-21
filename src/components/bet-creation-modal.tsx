
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
import { app } from "@/lib/firebase";
import { Separator } from "./ui/separator";
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

const createBetSchema = (currentUserHandle: string = "") => z.object({
    stakeAmount: z.coerce
        .number()
        .min(1, "Stake must be at least $1.")
        .max(10000, "Stake cannot exceed $10,000."),
    betVisibility: z.enum(["public", "private"]).default("public"),
    opponentTwitter: z.string().optional()
}).refine(data => {
    if (data.betVisibility === 'private') {
        const handle = data.opponentTwitter?.replace('@', '').toLowerCase();
        return handle && /^[a-z0-9_]{1,15}$/.test(handle);
    }
    return true;
}, {
    message: "A valid Twitter handle (1-15 chars, letters, numbers, _) is required for a private challenge.",
    path: ["opponentTwitter"],
}).refine(data => {
    if (data.betVisibility === 'private' && data.opponentTwitter) {
        return data.opponentTwitter.replace('@','').toLowerCase() !== currentUserHandle.toLowerCase();
    }
    return true;
}, {
    message: "You cannot challenge yourself.",
    path: ["opponentTwitter"],
});


type BetFormData = z.infer<ReturnType<typeof createBetSchema>>;

const OddsInfo = ({ label, value }: { label: string, value: React.ReactNode }) => (
    <div className="flex justify-between items-center text-sm">
        <p className="text-muted-foreground">{label}</p>
        <p className="font-bold">{value}</p>
    </div>
);


export function BetCreationModal({ isOpen, onOpenChange, game, selectedBet, userProfile }: BetCreationModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [betId, setBetId] = React.useState<string | null>(null);
  
  const form = useForm<BetFormData>({
    resolver: zodResolver(createBetSchema(userProfile?.username)),
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
    
    setIsLoading(true);

    const functions = getFunctions(app);
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
      } else {
        throw new Error(result.data.error || "Failed to create bet.");
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
        setIsLoading(false);
    }
  };


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

  const renderContent = () => {
      if (isSuccess && betId) {
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

      return (
        <Form {...form}>
            <form id="bet-details-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                 <DialogFooter className="pt-4">
                    <Button type="submit" disabled={isLoading} className="w-full" size="lg">{isLoading ? <Loader2 className="animate-spin" /> : "Create Challenge"}</Button>
                </DialogFooter>
            </form>
        </Form>
      )
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
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
}
