
"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import type { Game } from "@/types";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, ClipboardCopy, ArrowRight, ArrowLeft, Twitter } from "lucide-react";
import { getFirestore, collection, getDocs, query, orderBy, Timestamp } from "firebase/firestore";

const getEvents = async (): Promise<Game[]> => {
    const db = getFirestore(getFirebaseApp());
    const gamesRef = collection(db, "games");
    const q = query(
      gamesRef,
      orderBy("commence_time", "asc")
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        commence_time: (data.commence_time as Timestamp).toDate().toISOString(),
      } as unknown as Game;
    });
};

const betSchema = z.object({
  gameId: z.string().min(1, "Please select an event."),
  wagerAmount: z.coerce.number().min(1, "Wager must be at least $1."),
  betType: z.enum(["moneyline", "spread", "totals"]),
  recipientTwitterHandle: z.string().min(1, "Opponent's Twitter handle is required.").max(15, "Twitter handle cannot be longer than 15 characters."),
  
  // Dynamic fields based on betType
  team: z.string().optional(),
  points: z.coerce.number().optional(),
  over_under: z.enum(["over", "under"]).optional(),
  total: z.coerce.number().optional(),
}).refine(data => {
    if(data.betType === 'moneyline') return !!data.team;
    if(data.betType === 'spread') return !!data.team && data.points !== undefined;
    if(data.betType === 'totals') return !!data.over_under && data.total !== undefined;
    return false;
}, {
    message: "Please complete all fields for the selected bet type.",
    path: ["betType"],
});

type FormData = z.infer<typeof betSchema>;

export function CreateBetForm() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [step, setStep] = React.useState(1);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [challengeLink, setChallengeLink] = React.useState<string | null>(null);

  const [events, setEvents] = React.useState<Game[]>([]);
  const [loading, setLoading] = React.useState<'events' | false>(false);
  
  const form = useForm<FormData>({
    resolver: zodResolver(betSchema),
    defaultValues: {
      wagerAmount: 20,
      betType: "moneyline",
    }
  });

  const selectedEventId = form.watch("gameId");
  const betType = form.watch("betType");

  React.useEffect(() => {
    const loadEvents = async () => {
        setLoading('events');
        const fetchedEvents = await getEvents();
        setEvents(fetchedEvents);
        setLoading(false);
    }
    loadEvents();
  }, []);

  const onSubmit = async (data: FormData) => {
    if (!user) return toast({ title: "Not Authenticated", variant: "destructive" });
    setIsSubmitting(true);
    
    const selectedEvent = events.find(e => e.id === data.gameId);
    if (!selectedEvent) {
        setIsSubmitting(false);
        return toast({ title: "Selected event not found", variant: "destructive" });
    }

    const functions = getFunctions(getFirebaseApp());
    const createBetPaymentIntent = httpsCallable(functions, 'createBetPaymentIntent');
    const createBet = httpsCallable(functions, 'createBet');

    try {
        // Step 1: Create Payment Intent
        const paymentResult: any = await createBetPaymentIntent({ wagerAmount: data.wagerAmount });
        if (!paymentResult.data.success) {
            throw new Error(paymentResult.data.message || "Failed to create payment intent.");
        }
        const { paymentIntentId } = paymentResult.data;

        // Step 2: Create Bet Document with the payment intent ID
        let betValue: any = {};
        if (data.betType === 'moneyline') betValue = { team: data.team };
        else if (data.betType === 'spread') betValue = { team: data.team, points: data.points };
        else if (data.betType === 'totals') betValue = { over_under: data.over_under, total: data.total };

        const payload = {
          gameId: selectedEvent.id,
          gameDetails: {
              home_team: selectedEvent.home_team,
              away_team: selectedEvent.away_team,
              commence_time: selectedEvent.commence_time,
          },
          wagerAmount: data.wagerAmount,
          betType: data.betType,
          betValue: betValue,
          recipientTwitterHandle: data.recipientTwitterHandle,
          stripePaymentIntentId: paymentIntentId,
        };
    
        const betResult: any = await createBet(payload);
        if (betResult.data.success) {
            setChallengeLink(`${window.location.origin}/bet/${betResult.data.betId}`);
            toast({ title: "Bet Created Successfully!" });
            setStep(3); // Move to final step
        } else {
            throw new Error(betResult.data.message || "Failed to create bet.");
        }
    } catch (error: any) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleNextStep = async () => {
    let fieldsToValidate: (keyof FormData)[] = [];
    if (step === 1) fieldsToValidate = ["gameId"];
    if (step === 2) {
        fieldsToValidate = ["wagerAmount", "recipientTwitterHandle", "betType"];
         // Add bet-type specific fields for validation
        const betType = form.getValues("betType");
        if (betType === 'moneyline') fieldsToValidate.push("team");
        if (betType === 'spread') {
            fieldsToValidate.push("team");
            fieldsToValidate.push("points");
        }
        if (betType === 'totals') {
            fieldsToValidate.push("over_under");
            fieldsToValidate.push("total");
        }
    }
    
    const isValid = await form.trigger(fieldsToValidate);
    if (isValid) {
        if(step === 2) {
            await onSubmit(form.getValues());
        } else {
            setStep(s => s + 1);
        }
    }
  };
  
  const handlePrevStep = () => setStep(s => s - 1);
  
  const handleCopyToClipboard = () => {
    if (challengeLink) {
      navigator.clipboard.writeText(challengeLink);
      toast({ title: "Copied to clipboard!" });
    }
  };
  
  const selectedEvent = events.find(e => e.id === form.watch('gameId'));


  const renderStep = () => {
    switch(step) {
      case 1:
        return (
            <>
                <CardHeader>
                    <CardTitle className="font-bold">Step 1: Select the Game</CardTitle>
                    <CardDescription>Choose the game for your challenge.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Event</Label>
                        <Controller
                            control={form.control}
                            name="gameId"
                            render={({ field }) => (
                                <Select onValueChange={field.onChange} defaultValue={field.value} disabled={loading === 'events' || !events.length}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select an event..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                            {loading === 'events' ? <SelectItem value="loading" disabled>Loading events...</SelectItem> : events.map(e => <SelectItem key={e.id} value={e.id}>{e.away_team} @ {e.home_team}</SelectItem>)}
                                            {!loading && events.length === 0 && <SelectItem value="no-events" disabled>No upcoming events.</SelectItem>}
                                    </SelectContent>
                                </Select>
                            )}
                        />
                        {form.formState.errors.gameId && <p className="text-sm text-destructive">{form.formState.errors.gameId.message}</p>}
                    </div>
                </CardContent>
                <CardFooter className="justify-end">
                    <Button onClick={handleNextStep} disabled={!form.watch('gameId')}>Next <ArrowRight className="ml-2" /></Button>
                </CardFooter>
            </>
        )
      case 2:
        return (
             <>
                <CardHeader>
                    <CardTitle className="font-bold">Step 2: Set the Terms</CardTitle>
                    <CardDescription>Define your challenge for {selectedEvent?.away_team} @ {selectedEvent?.home_team}.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-2">
                            <Label htmlFor="wagerAmount">Wager ($)</Label>
                            <Input id="wagerAmount" type="number" {...form.register("wagerAmount")} />
                            {form.formState.errors.wagerAmount && <p className="text-sm text-destructive">{form.formState.errors.wagerAmount.message}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="recipientTwitterHandle">Opponent</Label>
                            <div className="relative">
                                <Twitter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input id="recipientTwitterHandle" placeholder="@BenTheBettor" className="pl-9" {...form.register("recipientTwitterHandle")} />
                            </div>
                            {form.formState.errors.recipientTwitterHandle && <p className="text-sm text-destructive">{form.formState.errors.recipientTwitterHandle.message}</p>}
                        </div>
                    </div>
                     <div className="space-y-2">
                        <Label>Bet Type</Label>
                        <Controller
                            control={form.control}
                            name="betType"
                            render={({ field }) => (
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="moneyline">Moneyline (Winner)</SelectItem>
                                        <SelectItem value="spread">Point Spread</SelectItem>
                                        <SelectItem value="totals">Totals (Over/Under)</SelectItem>
                                    </SelectContent>
                                </Select>
                            )}
                        />
                    </div>
                    {betType === "moneyline" && (
                         <div className="space-y-2">
                            <Label>Your Pick</Label>
                             <Controller
                                control={form.control}
                                name="team"
                                render={({ field }) => (
                                     <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <SelectTrigger><SelectValue placeholder="Select team to win..."/></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={selectedEvent!.home_team}>{selectedEvent!.home_team}</SelectItem>
                                            <SelectItem value={selectedEvent!.away_team}>{selectedEvent!.away_team}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                )}/>
                                 {form.formState.errors.team && <p className="text-sm text-destructive">{form.formState.errors.team.message}</p>}
                        </div>
                    )}
                    {betType === "spread" && (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Your Pick</Label>
                                 <Controller
                                    control={form.control}
                                    name="team"
                                    render={({ field }) => (
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <SelectTrigger><SelectValue placeholder="Select team..."/></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value={selectedEvent!.home_team}>{selectedEvent!.home_team}</SelectItem>
                                                <SelectItem value={selectedEvent!.away_team}>{selectedEvent!.away_team}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                )}/>
                                 {form.formState.errors.team && <p className="text-sm text-destructive">{form.formState.errors.team.message}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="points">Point Spread</Label>
                                <Input id="points" type="number" step="0.5" placeholder="-5.5" {...form.register("points")} />
                                 {form.formState.errors.points && <p className="text-sm text-destructive">{form.formState.errors.points.message}</p>}
                            </div>
                        </div>
                    )}
                     {betType === "totals" && (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Your Pick</Label>
                                <Controller
                                    control={form.control}
                                    name="over_under"
                                    render={({ field }) => (
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <SelectTrigger><SelectValue placeholder="Select Over or Under"/></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="over">Over</SelectItem>
                                                <SelectItem value="under">Under</SelectItem>
                                            </SelectContent>
                                        </Select>
                                )}/>
                                {form.formState.errors.over_under && <p className="text-sm text-destructive">{form.formState.errors.over_under.message}</p>}
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="total">Total Points</Label>
                                <Input id="total" type="number" step="0.5" placeholder="212.5" {...form.register("total")} />
                                {form.formState.errors.total && <p className="text-sm text-destructive">{form.formState.errors.total.message}</p>}
                            </div>
                        </div>
                    )}
                     {form.formState.errors.betType && <p className="text-sm text-destructive">{form.formState.errors.betType.message}</p>}
                </CardContent>
                <CardFooter className="justify-between">
                     <Button onClick={handlePrevStep} variant="outline"><ArrowLeft className="mr-2" /> Back</Button>
                     <Button onClick={handleNextStep} disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="mr-2 animate-spin" /> : "Authorize & Create"}
                    </Button>
                </CardFooter>
            </>
        )
      case 3:
         const tweetText = encodeURIComponent(`@${form.getValues("recipientTwitterHandle")} I challenge you to a bet on Playcer! ${selectedEvent?.away_team} @ ${selectedEvent?.home_team}`);
         const tweetUrl = `https://twitter.com/intent/tweet?text=${tweetText}&url=${challengeLink}`;
         return (
             <>
                <CardHeader>
                    <CardTitle className="font-bold">Challenge Created!</CardTitle>
                    <CardDescription>Your bet is now pending. Copy the link and share it with your opponent to accept.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center space-x-2">
                        <Input value={challengeLink!} readOnly />
                        <Button onClick={handleCopyToClipboard} size="icon" aria-label="Copy link">
                            <ClipboardCopy className="h-4 w-4" />
                        </Button>
                    </div>
                     <a href={tweetUrl} target="_blank" rel="noopener noreferrer">
                        <Button className="w-full" variant="outline">
                            <Twitter className="mr-2" />
                            Tweet the Challenge
                        </Button>
                    </a>
                </CardContent>
                 <CardFooter className="justify-end">
                     <Button onClick={() => { form.reset(); setStep(1); }}>Create Another Bet</Button>
                </CardFooter>
            </>
         )
    }
  }

  return (
    <Card className="w-full">
        <form onSubmit={form.handleSubmit(onSubmit)}>
            {renderStep()}
        </form>
    </Card>
  );
}

    