
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
import { ClipboardCopy, Swords, Loader2 } from "lucide-react";
import { getFirebaseApp } from "@/lib/firebase";
import { Separator } from "./ui/separator";

interface BetCreationModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  game: Game;
}

const betSchema = z.object({
  teamSelection: z.string().min(1, "Please select a team."),
  stake: z.coerce.number().min(1, "Stake must be at least $1."),
});

type BetFormData = z.infer<typeof betSchema>;

const TeamDisplay = ({ team, price }: { team: string, price: number }) => (
    <div className="text-center">
        <p className="font-bold text-lg">{team}</p>
        <p className="font-mono text-sm text-muted-foreground">{price > 0 ? `+${price}` : price}</p>
    </div>
)

export function BetCreationModal({ isOpen, onOpenChange, game }: BetCreationModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);
  const [challengeLink, setChallengeLink] = React.useState<string | null>(null);

  const form = useForm<BetFormData>({
    resolver: zodResolver(betSchema),
    defaultValues: {
      stake: 10,
    },
  });

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
        odds: data.teamSelection === game.home_team ? -110 : -110, // Mock odds
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
        form.reset();
        setChallengeLink(null);
    }
    onOpenChange(open);
  }

  // Mock odds for display
  const homeOdds = -110;
  const awayOdds = -110;

  return (
    <Dialog open={isOpen} onOpenChange={handleModalClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Your Bet</DialogTitle>
          <DialogDescription>
            Set your terms for this matchup and challenge a friend.
          </DialogDescription>
        </DialogHeader>

        {challengeLink ? (
          <div className="space-y-4 py-8">
             <h3 className="font-headline font-black text-lg text-center">Share Your Challenge!</h3>
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
                    <TeamDisplay team={game.home_team} price={homeOdds} />
                    <div className="flex flex-col items-center text-muted-foreground">
                        <Swords />
                        <span className="text-xs mt-1">vs</span>
                    </div>
                    <TeamDisplay team={game.away_team} price={awayOdds} />
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
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                <DialogFooter className="pt-4">
                    <Button type="submit" disabled={isLoading} className="w-full" size="lg">
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
