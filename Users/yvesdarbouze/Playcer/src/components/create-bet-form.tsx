
"use client";

import * as React from "react";
import { useRouter } from 'next/navigation';
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// This component is now a placeholder as the main logic has been
// centralized into the more advanced BetCreationModal.
export function CreateBetForm() {
    const router = useRouter();

    React.useEffect(() => {
        // Redirect users to the main page where they can select a game
        // and launch the proper bet creation flow.
        router.push('/');
    }, [router]);

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle>Create a Bet</CardTitle>
                <CardDescription>
                    Redirecting you to the game list to start a challenge...
                </CardDescription>
            </CardHeader>
        </Card>
    );
}
