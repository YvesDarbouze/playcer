
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '@/lib/firebase';
import { format } from "date-fns";

type ArbitrageOpportunity = {
    id: string;
    sport_key: string;
    sport_title: string;
    commence_time: string;
    home_team: string;
    away_team: string;
    profit_percentage: number;
    outcomes: {
        name: string;
        bookmaker: string;
        price: number;
    }[];
};

const functions = getFunctions(app);
const getArbitrageOpportunities = httpsCallable(functions, 'getArbitrageOpportunities');

export default function ArbitrageFinderPage() {
    const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleFetchOpportunities = async () => {
        setLoading(true);
        setError(null);
        try {
            const result: any = await getArbitrageOpportunities();
            if (result.data.success) {
                setOpportunities(result.data.data);
            } else {
                throw new Error(result.data.message || "Failed to fetch arbitrage opportunities.");
            }
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };
    
    useEffect(() => {
        handleFetchOpportunities();
    }, []);

    return (
        <main className="container mx-auto p-4 md:p-8">
            <Card>
                <CardHeader>
                    <CardTitle>Arbitrage Finder</CardTitle>
                    <CardDescription>
                        This page displays arbitrage opportunities found from the SportsGameOdds API.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button onClick={handleFetchOpportunities} disabled={loading}>
                        {loading && <Loader2 className="mr-2 animate-spin" />}
                        Refresh
                    </Button>
                    
                    {error && <p className="mt-4 text-destructive">{error}</p>}

                    {opportunities.length > 0 && (
                        <Table className="mt-4">
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Profit %</TableHead>
                                    <TableHead>Event</TableHead>
                                    <TableHead>Opportunities</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {opportunities.map(opp => (
                                    <TableRow key={opp.id}>
                                        <TableCell className="font-bold text-green-500">{opp.profit_percentage.toFixed(2)}%</TableCell>
                                        <TableCell>
                                            <div>{opp.away_team} @ {opp.home_team}</div>
                                            <div className="text-xs text-muted-foreground">{format(new Date(opp.commence_time), "PPp")}</div>
                                        </TableCell>
                                        <TableCell>
                                            {opp.outcomes.map(o => (
                                                <div key={`${o.bookmaker}-${o.name}`} className="text-xs">
                                                    <span className="font-bold">{o.name}:</span> {o.price} on {o.bookmaker}
                                                </div>
                                            ))}
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
