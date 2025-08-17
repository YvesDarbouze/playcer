
"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ArbitrageFinderPage() {
    const router = useRouter();

    return (
        <main className="container mx-auto p-4 md:p-8">
            <Card>
                <CardHeader>
                    <CardTitle>Feature Removed</CardTitle>
                    <CardDescription>
                        The Arbitrage Finder feature was specific to a previously used API and has been removed.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground mb-4">
                        This functionality is no longer available.
                    </p>
                    <Button onClick={() => router.push('/')}>
                        Back to Home
                    </Button>
                </CardContent>
            </Card>
        </main>
    );
}
