
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, TrendingUp, Info } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getFirebaseApp } from '@/lib/firebase';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";


type ArbitrageOpportunity = {
    event: {
        name: string;
        startTime: string;
    };
    market: {
        type: string;
        segment: string;
    };
    profit: number;
    outcomes: {
        source: string;
        name: string;
        payout: number;
        modifier: number;
    }[];
};

const functions = getFunctions(getFirebaseApp());
const getArbitrageOpportunitiesFn = httpsCallable(functions, 'getArbitrageOpportunities');


export default function ArbitrageFinderPage() {
    const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleFetchArbitrage = async () => {
        setLoading(true);
        setError(null);
        try {
            const result: any = await getArbitrageOpportunitiesFn();
            const fetchedData = result.data?.advantages;
            if (!fetchedData || fetchedData.length === 0) {
                setError("No arbitrage opportunities found at the moment.");
            }
            setOpportunities(fetchedData);
        } catch (e: any) {
            console.error("Error fetching arbitrage data:", e);
            setError(e.message || "An unknown error occurred.");
        } finally {
            setLoading(false);
        }
    };
    
    useEffect(() => {
        handleFetchArbitrage();
    }, []);

    return (
        <main className="container mx-auto p-4 md:p-8">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="text-primary" />
                        Arbitrage Finder
                    </CardTitle>
                    <CardDescription>
                        Discover risk-free profit opportunities by leveraging odds differences across sportsbooks.
                        This data is fetched in real-time.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button onClick={handleFetchArbitrage} disabled={loading}>
                        {loading && <Loader2 className="mr-2 animate-spin" />}
                        Refresh Opportunities
                    </Button>
                    
                    {error && <p className="mt-4 text-destructive">{error}</p>}

                    {opportunities.length > 0 && (
                        <Table className="mt-4">
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Event</TableHead>
                                    <TableHead>Market</TableHead>
                                    <TableHead className="text-center">Profit %</TableHead>
                                    <TableHead>Bets to Place</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {opportunities.map((opp, index) => (
                                    <TableRow key={index}>
                                        <TableCell>
                                            <div className="font-medium">{opp.event.name}</div>
                                            <div className="text-sm text-muted-foreground">
                                                {new Date(opp.event.startTime).toLocaleString()}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{opp.market.type}</Badge>
                                        </TableCell>
                                        <TableCell className="text-center font-bold text-green-500">
                                            {(opp.profit * 100).toFixed(2)}%
                                        </TableCell>
                                        <TableCell>
                                            <div className="space-y-2">
                                                {opp.outcomes.map((outcome, i) => (
                                                    <div key={i} className="flex items-center gap-2 text-sm">
                                                        <span className="font-semibold">{outcome.source}:</span>
                                                        <span>{outcome.name} {outcome.modifier !== 0 && outcome.modifier}</span>
                                                        <Badge variant="secondary">{(outcome.payout).toFixed(2)}</Badge>
                                                    </div>
                                                ))}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </main>
    );
}


    
