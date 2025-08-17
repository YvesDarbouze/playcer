
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface ConsensusOddsDisplayProps {
    consensusData: any;
    loading: boolean;
}

const ConsensusDetail = ({ label, value }: { label: string, value: string | number | undefined }) => {
    if (value === undefined || value === null) return null;
    return (
        <div className="text-center">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="font-bold text-lg text-primary">{value}</p>
        </div>
    )
}

export function ConsensusOddsDisplay({ consensusData, loading }: ConsensusOddsDisplayProps) {
    if (loading) {
        return <Skeleton className="h-24 w-full" />
    }

    if (!consensusData) {
        return null;
    }

    const spreads = consensusData.odds?.spreads;
    const totals = consensusData.odds?.totals;

    return (
        <Card className="bg-muted/30">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg">Consensus Lines</CardTitle>
                <CardDescription>
                    The fair value and average book lines across the market.
                </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
                {spreads && (
                    <div className="p-2 rounded-md border">
                        <h4 className="font-bold text-center text-sm mb-2">Spread</h4>
                        <div className="grid grid-cols-2 gap-2">
                            <ConsensusDetail label="Fair Line" value={spreads.fairSpread} />
                            <ConsensusDetail label="Book Line" value={spreads.bookSpread} />
                        </div>
                    </div>
                )}
                 {totals && (
                    <div className="p-2 rounded-md border">
                        <h4 className="font-bold text-center text-sm mb-2">Total (Over/Under)</h4>
                        <div className="grid grid-cols-2 gap-2">
                            <ConsensusDetail label="Fair Line" value={totals.fairOverUnder} />
                            <ConsensusDetail label="Book Line" value={totals.bookOverUnder} />
                        </div>
                    </div>
                )}

            </CardContent>
        </Card>
    );
}
