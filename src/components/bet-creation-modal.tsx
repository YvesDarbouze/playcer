
"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { getFunctions, httpsCallable } from "firebase/functions";
import { collection, onSnapshot, query, getFirestore, limit } from "firebase/firestore";
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
import { ClipboardCopy, Swords, Loader2 } from "lucide-react";
import { getFirebaseApp } from "@/lib/firebase";
import { Separator } from "./ui/separator";
import { Skeleton } from "./ui/skeleton";

interface BetCreationModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  game: Game;
}

type BookmakerOdds = {
    key: string;
    title: string;
    last_update: string;
    markets: {
        key: "h2h";
        outcomes: { name: string; price: number }[];
    }[];
};


const betSchema = z.object({
  teamSelection: z.string().min(1, "Please select a team."),
  stake: z.coerce.number().min(1, "Stake must be at least $1."),
  odds: z.coerce.number().int("Odds are required."),
});

type BetFormData = z.infer<typeof betSchema>;

const TeamDisplay = ({ team, price }: { team: string, price: number | undefined }) => (
    <div className="text-center">
        <p className="font-bold text-lg">{team}</p>
        {price !== undefined ? (
             <p className="font-mono text-sm text-muted-foreground">{price > 0 ? `+${price}` : price}</p>
        ) : (
            <Skeleton className="h-5 w-12 mx-auto mt-1" />
        )}
    </div>
)

export function BetCreationModal({ isOpen, onOpenChange, game }: BetCreationModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);
  const [challengeLink, setChallengeLink] = React.useState<string | null>(null);
  const [odds, setOdds] = React.useState<BookmakerOdds[]>([]);
  const [loadingOdds, setLoadingOdds] = React.useState(true);


  React.useEffect(() => {
    if (!isOpen) return;

    const db = getFirestore(getFirebaseApp());
    const oddsQuery = query(
        collection(db, `games/${game.id}/bookmaker_odds`),
        limit(1) // Get the first available bookmaker
    );

    const unsubscribe = onSnapshot(oddsQuery, (snapshot) => {
        if (!snapshot.empty) {
            const oddsData = snapshot.docs.map(doc => doc.data() as BookmakerOdds);
            setOdds(oddsData);
        }
        setLoadingOdds(false);
    }, (error) => {
        console.error("Error fetching odds:", error);
        setLoadingOdds(false);
    });

    return () => unsubscribe();
  }, [game.id, isOpen]);


  const form = useForm<BetFormData>({
    resolver: zodResolver(betSchema),
    defaultValues: {
      stake: 10,
    },
  });

  const selectedTeam = form.watch("teamSelection");

  // Update the odds in the form when a team is selected
  React.useEffect(() => {
    if (!selectedTeam || !odds.length) return;
    const h2hMarket = odds[0]?.markets.find(m => m.key === 'h2h');
    const outcome = h2hMarket?.outcomes.find(o => o.name === selectedTeam);
    if (outcome) {
        form.setValue("odds", outcome.price);
    }
  }, [selectedTeam, odds, form]);


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
    setChallengeLink(null);

    const functions = getFunctions(getFirebaseApp());
    const createBet = httpsCallable(functions, 'createBet');

    try {
       const betPayload = {
        ...data,
        sportKey: game.sport_key,
        eventId: game.id,
        eventDate: game.commence_time,
        homeTeam: game.home_team,
        awayTeam: game.away_team,
        betType: "moneyline",
        marketDescription: "Match Winner",
        outcomeDescription: `${data.teamSelection} to win`,
        line: null,
      };

      const result: any = await createBet(betPayload);

      if (result.data.success) {
        setChallengeLink(`${window.location.origin}/bet/${result.data.betId}`);
        toast({
          title: "Bet Created Successfully!",
          description: "Your challenge link is ready to be shared.",
        });
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
  
   const handleCopyToClipboard = () => {
    if (challengeLink) {
      navigator.clipboard.writeText(challengeLink);
      toast({ title: "Copied to clipboard!" });
    }
  };
  
  const handleModalClose = (open: boolean) => {
    if (!open) {
        form.reset({ stake: 10 });
        setChallengeLink(null);
        setLoadingOdds(true);
        setOdds([]);
    }
    onOpenChange(open);
  }

  const h2hMarket = odds[0]?.markets.find(m => m.key === 'h2h');
  const homeOdds = h2hMarket?.outcomes.find(o => o.name === game.home_team)?.price;
  const awayOdds = h2hMarket?.outcomes.find(o => o.name === game.away_team)?.price;

  return (
    <Dialog open={isOpen} onOpenChange={handleModalClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-bold">Create Your Bet</DialogTitle>
          <DialogDescription>
            Set your terms for this matchup and challenge a friend. Odds are live.
          </DialogDescription>
        </DialogHeader>

        {challengeLink ? (
          <div className="space-y-4 py-8">
             <h3 className="font-bold text-lg text-center">Share Your Challenge!</h3>
             <p className="text-sm text-center text-muted-foreground">Copy the link below and send it to an opponent.</p>
             <div className="flex items-center space-x-2">
                <Input value={challengeLink} readOnly />
                <Button onClick={handleCopyToClipboard} size="icon">
                    <ClipboardCopy className="h-4 w-4" />
                </Button>
            </div>
             <Button onClick={() => handleModalClose(false)} className="w-full">Done</Button>
          </div>
        ) : (
          <div>
            <div className="my-4 p-4 bg-muted rounded-lg">
                <div className="grid grid-cols-3 items-center text-center">
                    <TeamDisplay team={game.home_team} price={loadingOdds ? undefined : homeOdds} />
                    <div className="flex flex-col items-center text-muted-foreground">
                        <Swords />
                        <span className="text-xs mt-1">vs</span>
                    </div>
                    <TeamDisplay team={game.away_team} price={loadingOdds ? undefined : awayOdds} />
                </div>
            </div>
          
            <Separator className="my-6" />

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="teamSelection"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Your Pick</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value} disabled={loadingOdds}>
                            <FormControl>
                                <SelectTrigger>
                                <SelectValue placeholder="Select your team" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectItem value={game.home_team}>{game.home_team}</SelectItem>
                                <SelectItem value={game.away_team}>{game.away_team}</SelectItem>
                            </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="stake"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Wager ($)</FormLabel>
                            <FormControl>
                            <Input type="number" placeholder="10.00" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                </div>
                 <FormField
                    control={form.control}
                    name="odds"
                    render={({ field }) => ( <FormItem className="hidden">
                            <FormControl>
                                <Input type="hidden" {...field} />
                            </FormControl>
                             <FormMessage />
                        </FormItem>
                    )}
                />
                <DialogFooter className="pt-4">
                    <Button type="submit" disabled={isLoading || loadingOdds} className="w-full" size="lg">
                    {isLoading ? <Loader2 className="animate-spin" /> : "Create Bet & Get Link"}
                    </Button>
                </DialogFooter>
                </form>
            </Form>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
