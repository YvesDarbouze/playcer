
"use client";

import * as React from "react";
import { getFirestore, doc, updateDoc } from "firebase/firestore";
import { getFirebaseApp } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import type { User } from "@/types";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck, FileCheck, AlertTriangle } from "lucide-react";

type VerificationStatus = 'not_started' | 'in_progress' | 'submitted' | 'failed';

// --- Placeholder for a third-party KYC SDK ---
const personaSDK = {
    init: ({ onComplete, onCancel, onError }: { onComplete: () => void, onCancel: () => void, onError: (error: Error) => void }) => {
        console.log("Initializing Persona SDK...");
        
        const open = () => {
            console.log("Opening Persona inquiry...");
            // Simulate a user going through the flow
            setTimeout(() => {
                // Simulate a random outcome
                const random = Math.random();
                if (random < 0.7) { // 70% chance of success
                    console.log("Persona inquiry completed successfully.");
                    onComplete();
                } else if (random < 0.9) { // 20% chance of user cancelling
                    console.log("Persona inquiry cancelled by user.");
                    onCancel();
                } else { // 10% chance of an error
                    console.error("Persona inquiry failed with an error.");
                    onError(new Error("Failed to capture documents."));
                }
            }, 3000); // Simulate a 3-second process
        };

        return { open };
    },
};
// --- End of placeholder ---


export function IdentityVerification({ user }: { user: User }) {
  const { toast } = useToast();
  const [status, setStatus] = React.useState<VerificationStatus>('not_started');

  const handleVerification = () => {
    setStatus('in_progress');

    const persona = personaSDK.init({
      onComplete: async () => {
        // In a real app, the backend would receive a webhook from Persona.
        // For this simulation, we'll update Firestore directly from the client.
        const db = getFirestore(getFirebaseApp());
        const userDocRef = doc(db, "users", user.id);
        try {
            // Note: This is a simulation. In a real app, you would not change the status
            // to 'verified' here, but to something like 'in_review'.
            // The final 'verified' status would be set by a secured Cloud Function
            // that processes the webhook from the KYC provider.
            await updateDoc(userDocRef, { kycStatus: 'in_review' });
            setStatus('submitted');
            toast({
                title: "Verification Submitted",
                description: "Your documents have been submitted for review. We'll notify you once the process is complete.",
            });
        } catch (error) {
             console.error("Error updating user status:", error);
             setStatus('failed');
             toast({
                title: "Submission Failed",
                description: "There was a problem submitting your verification. Please try again.",
                variant: "destructive",
            });
        }
      },
      onCancel: () => {
        setStatus('not_started');
        toast({
            title: "Verification Cancelled",
            description: "The verification process was cancelled.",
        });
      },
      onError: (error) => {
        setStatus('failed');
        toast({
            title: "Verification Error",
            description: error.message || "An unexpected error occurred.",
            variant: "destructive",
        });
      },
    });

    persona.open();
  };

  const renderContent = () => {
    switch (status) {
        case 'not_started':
        case 'failed':
            return (
                <>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><ShieldCheck /> Verify Your Identity</CardTitle>
                        <CardDescription>
                            To comply with regulations and ensure platform security, we need to verify your identity. This is a one-time process.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p>You will be asked to provide a photo of your government-issued ID and a selfie. Please have your document ready.</p>
                        {status === 'failed' && (
                            <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5" />
                                <p className="text-sm font-medium">Verification failed. Please try again.</p>
                            </div>
                        )}
                    </CardContent>
                    <CardFooter>
                        <Button onClick={handleVerification} className="w-full" size="lg">
                            Start Verification
                        </Button>
                    </CardFooter>
                </>
            );
        case 'in_progress':
            return (
                 <CardContent className="flex flex-col items-center justify-center p-10 text-center space-y-4">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <h3 className="text-xl font-bold">Connecting to Verification...</h3>
                    <p className="text-muted-foreground">Please follow the instructions in the secure window that opens.</p>
                </CardContent>
            );
        case 'submitted':
            return (
                 <CardContent className="flex flex-col items-center justify-center p-10 text-center space-y-4">
                    <FileCheck className="h-12 w-12 text-green-500" />
                    <h3 className="text-xl font-bold">Verification Submitted</h3>
                    <p className="text-muted-foreground">Your information is now under review. This usually takes a few minutes. We'll email you and update your dashboard once it's complete.</p>
                </CardContent>
            );
    }
  }


  return (
    <Card>
      {renderContent()}
    </Card>
  );
}
