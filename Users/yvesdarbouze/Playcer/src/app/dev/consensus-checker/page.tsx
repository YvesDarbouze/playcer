
"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getFirebaseApp } from '@/lib/firebase';

const functions = getFunctions(getFirebaseApp());
const getConsensusOdds = httpsCallable(functions, 'getConsensusOdds');

export default function ConsensusCheckerPage() {
    const [gameId, setGameId] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [consensusData, setConsensusData] = useState<any>(null);

    const handleFetchConsensus = async () => {
        if (!gameId) {
            setError("Please enter a Game ID.");
            return;
        }
        setLoading(true);
        setError(null);
        setConsensusData(null);
        try {
            const result: any = await getConsensusOdds({ gameId });
            if (result.data.success) {
                setConsensusData(result.data.data);
            } else {
                throw new Error(result.data.message || "Failed to fetch consensus data.");
            }
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <main className="container mx-auto p-4 md:p-8">
            <Card>
                <CardHeader>
                    <CardTitle>Developer: Consensus Odds Checker</CardTitle>
                    <CardDescription>
                        This page calls the `getConsensusOdds` cloud function to fetch the raw event data, including consensus lines, from the SportsGameOdds API for a specific game ID.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-2">
                         <Input 
                            placeholder="Enter Game ID (e.g., ..._NBA)"
                            value={gameId}
                            onChange={(e) => setGameId(e.target.value)}
                        />
                        <Button onClick={handleFetchConsensus} disabled={loading}>
                            {loading && <Loader2 className="mr-2 animate-spin" />}
                            Fetch Consensus
                        </Button>
                    </div>
                    
                    {error && <p className="mt-4 text-destructive">{error}</p>}

                    {consensusData && (
                        <pre className="mt-4 p-4 bg-muted rounded-md text-xs overflow-auto">
                            {JSON.stringify(consensusData, null, 2)}
                        </pre>
                    )}
                </CardContent>
            </Card>
        </main>
    );
}
