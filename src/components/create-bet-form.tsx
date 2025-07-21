
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
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ClipboardCopy, ArrowRight, ArrowLeft } from "lucide-react";
import { Separator } from "./ui/separator";

// --- Mock API Fetchers ---
// In a real app, these would be in a separate service file.
const getSports = async (): Promise<{ key: string, title: string }[]> => {
    // This is a mock. In a real app, you would fetch from TheOddsAPI.
    // Example: GET https://api.the-odds-api.com/v4/sports
    console.log("Fetching sports...");
    await new Promise(res => setTimeout(res, 500)); // Simulate network delay
    return [
        { key: 'americanfootball_nfl', title: 'NFL' },
        { key: 'basketball_nba', title: 'NBA' },
        { key: 'baseball_mlb', title: 'MLB' },
    ];
};

const getEvents = async (sportKey: string): Promise<Game[]> => {
    // This is a mock. In a real app, you would fetch from TheOddsAPI.
    // Example: GET https://api.the-odds-api.com/v4/sports/{sportKey}/odds
    console.log(`Fetching events for ${sportKey}...`);
    await new Promise(res => setTimeout(res, 800)); // Simulate network delay
    
    // Return mock data based on sport
    if (sportKey === 'basketball_nba') {
        return [
            { id: 'nba_1', commence_time: new Date().toISOString(), home_team: 'Lakers', away_team: 'Clippers', sport_key: sportKey, sport_title: "NBA" } as Game,
            { id: 'nba_2', commence_time: new Date().toISOString(), home_team: 'Celtics', away_team: 'Warriors', sport_key: sportKey, sport_title: "NBA" } as Game,
        ]
    }
     if (sportKey === 'americanfootball_nfl') {
        return [
            { id: 'nfl_1', commence_time: new Date().toISOString(), home_team: 'Rams', away_team: '49ers', sport_key: sportKey, sport_title: "NFL" } as Game,
            { id: 'nfl_2', commence_time: new Date().toISOString(), home_team: 'Chiefs', away_team: 'Eagles', sport_key: sportKey, sport_title: "NFL" } as Game,
        ]
    }
    return [];
};
// --- End Mock API Fetchers ---


const schema = z.object({
  sportKey: z.string().min(1, "Please select a sport."),
  eventId: z.string().min(1, "Please select an event."),
  marketDescription: z.string().min(5, "Market description is too short.").max(100),
  outcomeDescription: z.string().min(1, "Your pick is required.").max(100),
  teamSelection: z.string().min(1, "Team selection is required."),
  stake: z.coerce.number().min(1, "Stake must be at least $1."),
  odds: z.coerce.number().int().min(100, "Odds must be 100 or greater."),
});

type FormData = z.infer<typeof schema>;

export function CreateBetForm() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [step, setStep] = React.useState(1);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [challengeLink, setChallengeLink] = React.useState<string | null>(null);

  const [sports, setSports] = React.useState<{ key: string, title: string }[]>([]);
  const [events, setEvents] = React.useState<Game[]>([]);
  const [loading, setLoading] = React.useState<'sports' | 'events' | false>(false);
  
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      stake: 10,
      odds: 100,
    }
  });

  const selectedSport = form.watch("sportKey");
  const selectedEventId = form.watch("eventId");

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
        form.setValue("eventId", ""); // Reset event when sport changes
        const fetchedEvents = await getEvents(selectedSport);
        setEvents(fetchedEvents);
        setLoading(false);
    }
    loadEvents();
  }, [selectedSport, form]);
  
  const onSubmit = async (data: FormData) => {
    if (!user) return toast({ title: "Not Authenticated", variant: "destructive" });
    setIsSubmitting(true);
    
    const selectedEvent = events.find(e => e.id === data.eventId);
    if (!selectedEvent) return toast({ title: "Selected event not found", variant: "destructive" });

    const functions = getFunctions(getFirebaseApp());
    const createBet = httpsCallable(functions, 'createBet');

    const payload = {
      ...data,
      sportKey: selectedEvent.sport_key,
      eventDate: selectedEvent.commence_time,
      homeTeam: selectedEvent.home_team,
      awayTeam: selectedEvent.away_team,
      betType: "moneyline", // Custom bets are simplified as moneyline for now
      line: null,
    };
    
    try {
        const result: any = await createBet(payload);
        if (result.data.success) {
            setChallengeLink(`${window.location.origin}/bet/${result.data.betId}`);
            toast({ title: "Bet Created Successfully!" });
            setStep(4);
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
    if (step === 1) fieldsToValidate = ["sportKey", "eventId"];
    if (step === 2) fieldsToValidate = ["marketDescription", "outcomeDescription", "teamSelection"];
    
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


  const renderStep = () => {
    switch(step) {
      case 1:
        const selectedEvent = events.find(e => e.id === selectedEventId);
        return (
            <>
                <CardHeader>
                    <CardTitle>Step 1: Select the Game</CardTitle>
                    <CardDescription>Choose the sport and the specific game you want to bet on.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Sport</Label>
                        <Controller
                            control={form.control}
                            name="sportKey"
                            render={({ field }) => (
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <SelectTrigger disabled={loading === 'sports'}>
                                        <SelectValue placeholder="Select a sport..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {loading === 'sports' ? <SelectItem value="loading" disabled>Loading...</SelectItem> : sports.map(s => <SelectItem key={s.key} value={s.key}>{s.title}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            )}
                        />
                        {form.formState.errors.sportKey && <p className="text-sm text-destructive">{form.formState.errors.sportKey.message}</p>}
                    </div>
                    {selectedSport && (
                        <div className="space-y-2">
                            <Label>Event</Label>
                            <Controller
                                control={form.control}
                                name="eventId"
                                render={({ field }) => (
                                    <Select onValueChange={(value) => {
                                        const event = events.find(e => e.id === value);
                                        if (event) {
                                          form.setValue('teamSelection', event.home_team)
                                        }
                                        field.onChange(value);
                                    }} defaultValue={field.value}>
                                        <SelectTrigger disabled={loading === 'events' || !events.length}>
                                            <SelectValue placeholder="Select an event..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                             {loading === 'events' ? <SelectItem value="loading" disabled>Loading events...</SelectItem> : events.map(e => <SelectItem key={e.id} value={e.id}>{e.away_team} @ {e.home_team}</SelectItem>)}
                                             {!loading && events.length === 0 && <SelectItem value="no-events" disabled>No upcoming events.</SelectItem>}
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                            {form.formState.errors.eventId && <p className="text-sm text-destructive">{form.formState.errors.eventId.message}</p>}
                        </div>
                    )}
                </CardContent>
                <CardFooter className="justify-end">
                    <Button onClick={handleNextStep}>Next <ArrowRight className="ml-2" /></Button>
                </CardFooter>
            </>
        )
      case 2:
        const currentEvent = events.find(e => e.id === form.getValues("eventId"));
        return (
             <>
                <CardHeader>
                    <CardTitle>Step 2: Define the Bet</CardTitle>
                    <CardDescription>Describe what you're betting on. E.g., "Winner of the match" or "Total points scored".</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <div className="space-y-2">
                        <Label htmlFor="marketDescription">Bet Market</Label>
                        <Input id="marketDescription" placeholder="e.g., Final score winner" {...form.register("marketDescription")} />
                        {form.formState.errors.marketDescription && <p className="text-sm text-destructive">{form.formState.errors.marketDescription.message}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="outcomeDescription">Your Specific Pick</Label>
                        <Input id="outcomeDescription" placeholder="e.g., Team A to win by 10+ points" {...form.register("outcomeDescription")} />
                         {form.formState.errors.outcomeDescription && <p className="text-sm text-destructive">{form.formState.errors.outcomeDescription.message}</p>}
                    </div>
                     <div className="space-y-2">
                        <Label>Which team does your pick favor?</Label>
                         <Controller
                            control={form.control}
                            name="teamSelection"
                            render={({ field }) => (
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select the favored team" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={currentEvent!.home_team}>{currentEvent!.home_team}</SelectItem>
                                        <SelectItem value={currentEvent!.away_team}>{currentEvent!.away_team}</SelectItem>
                                    </SelectContent>
                                </Select>
                            )}
                        />
                         {form.formState.errors.teamSelection && <p className="text-sm text-destructive">{form.formState.errors.teamSelection.message}</p>}
                    </div>
                </CardContent>
                <CardFooter className="justify-between">
                     <Button onClick={handlePrevStep} variant="outline"><ArrowLeft className="mr-2" /> Back</Button>
                     <Button onClick={handleNextStep}>Next <ArrowRight className="ml-2" /></Button>
                </CardFooter>
            </>
        )
      case 3:
        return (
             <>
                <CardHeader>
                    <CardTitle>Step 3: Set the Terms</CardTitle>
                    <CardDescription>Define the financial terms of your bet. The odds determine the payout for the winner.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <div className="space-y-2">
                        <Label htmlFor="stake">Your Wager ($)</Label>
                        <Input id="stake" type="number" {...form.register("stake")} />
                         {form.formState.errors.stake && <p className="text-sm text-destructive">{form.formState.errors.stake.message}</p>}
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="odds">American Odds</Label>
                        <Input id="odds" type="number" placeholder="e.g., 110, 200" {...form.register("odds")} />
                        <p className="text-xs text-muted-foreground">Enter positive odds (e.g., 150). Your opponent will get the inverse (-150).</p>
                        {form.formState.errors.odds && <p className="text-sm text-destructive">{form.formState.errors.odds.message}</p>}
                    </div>
                </CardContent>
                 <CardFooter className="justify-between">
                     <Button onClick={handlePrevStep} variant="outline"><ArrowLeft className="mr-2" /> Back</Button>
                     <Button onClick={form.handleSubmit(onSubmit)} disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 animate-spin" />}
                        Create Bet & Get Link
                    </Button>
                </CardFooter>
            </>
        )
      case 4:
         return (
             <>
                <CardHeader>
                    <CardTitle>Challenge Created!</CardTitle>
                    <CardDescription>Your bet is now live. Copy the link below and share it to find an opponent.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center space-x-2">
                        <Input value={challengeLink!} readOnly />
                        <Button onClick={handleCopyToClipboard} size="icon" aria-label="Copy link">
                            <ClipboardCopy className="h-4 w-4" />
                        </Button>
                    </div>
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
