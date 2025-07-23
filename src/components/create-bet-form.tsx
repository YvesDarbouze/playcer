

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

// --- Mock API Fetchers ---
const getSports = async (): Promise<{ key: string, title: string }[]> => {
    console.log("Fetching sports...");
    await new Promise(res => setTimeout(res, 500));
    return [
        { key: 'americanfootball_nfl', title: 'NFL' },
        { key: 'basketball_nba', title: 'NBA' },
        { key: 'baseball_mlb', title: 'MLB' },
    ];
};

const getEvents = async (sportKey: string): Promise<Game[]> => {
    console.log(`Fetching events for ${sportKey}...`);
    await new Promise(res => setTimeout(res, 800));
    
    if (sportKey === 'basketball_nba') {
        return [
            { id: 'nba_1', commence_time: new Date(Date.now() + 3600000).toISOString(), home_team: 'Lakers', away_team: 'Celtics', sport_key: sportKey, sport_title: "NBA" } as Game,
            { id: 'nba_2', commence_time: new Date(Date.now() + 7200000).toISOString(), home_team: 'Bucks', away_team: 'Warriors', sport_key: sportKey, sport_title: "NBA" } as Game,
        ]
    }
     if (sportKey === 'americanfootball_nfl') {
        return [
            { id: 'nfl_1', commence_time: new Date(Date.now() + 10800000).toISOString(), home_team: 'Rams', away_team: '49ers', sport_key: sportKey, sport_title: "NFL" } as Game,
            { id: 'nfl_2', commence_time: new Date(Date.now() + 14400000).toISOString(), home_team: 'Chiefs', away_team: 'Eagles', sport_key: sportKey, sport_title: "NFL" } as Game,
        ]
    }
    return [];
};
// --- End Mock API Fetchers ---

const betSchema = z.object({
  gameId: z.string().min(1, "Please select an event."),
  wagerAmount: z.coerce.number().min(1, "Wager must be at least $1."),
  betType: z.enum(["moneyline", "spread", "totals"]),
  recipientTwitterHandle: z.string().min(1, "Opponent's Twitter handle is required.").max(15),
  
  // Dynamic fields based on betType
  team: z.string().optional(),
  points: z.coerce.number().optional(),
  over_under: z.enum(["over", "under"]).optional(),
  total: z.coerce.number().optional(),
});

type FormData = z.infer<typeof betSchema>;

export function CreateBetForm() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [step, setStep] = React.useState(1);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [challengeLink, setChallengeLink] = React.useState<string | null>(null);

  const [sports, setSports] = React.useState<{ key: string, title: string }[]>([]);
  const [events, setEvents] = React.useState<Game[]>([]);
  const [selectedSport, setSelectedSport] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState<'sports' | 'events' | false>(false);
  
  const form = useForm<FormData>({
    resolver: zodResolver(betSchema),
    defaultValues: {
      wagerAmount: 20,
      betType: "moneyline",
    }
  });

  const selectedEventId = form.watch("eventId");
  const betType = form.watch("betType");

  React.useEffect(() => {
    const loadSports = async () => {
        setLoading('sports');
        const fetchedSports = await getSports();
        setSports(fetchedSports);
        setLoading(false);
    }
    loadSports();
  }, []);

  React.useEffect(() => {
    if (!selectedSport) return;
    const loadEvents = async () => {
        setLoading('events');
        setEvents([]);
        form.setValue("gameId", "");
        const fetchedEvents = await getEvents(selectedSport);
        setEvents(fetchedEvents);
        setLoading(false);
    }
    loadEvents();
  }, [selectedSport, form]);
  
  const onSubmit = async (data: FormData) => {
    if (!user) return toast({ title: "Not Authenticated", variant: "destructive" });
    setIsSubmitting(true);
    
    const selectedEvent = events.find(e => e.id === data.gameId);
    if (!selectedEvent) return toast({ title: "Selected event not found", variant: "destructive" });

    // Construct betValue based on betType
    let betValue: any = {};
    if (data.betType === 'moneyline') {
        betValue = { team: data.team, odds: 100 }; // Default odds for now
    } else if (data.betType === 'spread') {
        betValue = { team: data.team, points: data.points, odds: -110 };
    } else if (data.betType === 'totals') {
        betValue = { over_under: data.over_under, total: data.total, odds: -110 };
    }

    const functions = getFunctions(getFirebaseApp());
    const createBet = httpsCallable(functions, 'createBet');

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
    };
    
    try {
        const result: any = await createBet(payload);
        if (result.data.success) {
            setChallengeLink(`${window.location.origin}/bet/${result.data.betId}`);
            toast({ title: "Bet Created Successfully!" });
            setStep(3); // Move to final step
        } else {
            throw new Error(result.data.error || "Failed to create bet.");
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
    if (step === 2) fieldsToValidate = ["wagerAmount", "betType", "recipientTwitterHandle", "team", "points", "over_under", "total"];
    
    const isValid = await form.trigger(fieldsToValidate);
    if (isValid) {
      setStep(s => s + 1);
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
                    <CardDescription>Choose the sport and the specific game for your challenge.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Sport</Label>
                        <Select onValueChange={setSelectedSport} disabled={loading === 'sports'}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a sport..." />
                            </SelectTrigger>
                            <SelectContent>
                                {loading === 'sports' ? <SelectItem value="loading" disabled>Loading...</SelectItem> : sports.map(s => <SelectItem key={s.key} value={s.key}>{s.title}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    {selectedSport && (
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
                    )}
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
                                        <SelectItem value="moneyline">Moneyline</SelectItem>
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
                                        <SelectTrigger><SelectValue placeholder="Select team..."/></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={selectedEvent!.home_team}>{selectedEvent!.home_team}</SelectItem>
                                            <SelectItem value={selectedEvent!.away_team}>{selectedEvent!.away_team}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                )}/>
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
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="points">Line</Label>
                                <Input id="points" type="number" step="0.5" placeholder="-5.5" {...form.register("points")} />
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
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="total">Total</Label>
                                <Input id="total" type="number" step="0.5" placeholder="212.5" {...form.register("total")} />
                            </div>
                        </div>
                    )}
                </CardContent>
                <CardFooter className="justify-between">
                     <Button onClick={handlePrevStep} variant="outline"><ArrowLeft className="mr-2" /> Back</Button>
                     <Button onClick={form.handleSubmit(onSubmit)} disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="mr-2 animate-spin" /> : "Create & Get Link"}
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
                     <Button onClick={() => setStep(1)}>Create Another Bet</Button>
                </CardFooter>
            </>
         )
    }
  }


  return (
    <Card className="w-full">
      {renderStep()}
    </Card>
  );
}
