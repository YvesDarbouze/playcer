
"use client";

import * as React from "react";
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
// In a real app, you would replace this with the actual SDK
// from a provider like Persona, Veriff, or Stripe Identity.
const thirdPartyKycSDK = {
    init: ({ templateId, onComplete, onCancel, onError }: { templateId: string, onComplete: (inquiryId: string) => void, onCancel: () => void, onError: (error: Error) => void }) => {
        console.log(`Initializing KYC SDK with template: ${templateId}`);
        
        const open = () => {
            console.log("Opening KYC inquiry...");
            // This timeout simulates a user interacting with the third-party UI.
            setTimeout(() => {
                const random = Math.random();
                if (random < 0.8) { // 80% chance of success
                    const fakeInquiryId = `inq_${Date.now()}`;
                    console.log(`KYC inquiry completed successfully. Inquiry ID: ${fakeInquiryId}`);
                    onComplete(fakeInquiryId);
                } else if (random < 0.95) { // 15% chance of user cancelling
                    console.log("KYC inquiry cancelled by user.");
                    onCancel();
                } else { // 5% chance of an error
                    console.error("KYC inquiry failed with a client-side error.");
                    onError(new Error("Failed to capture documents. Please try again."));
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

  // In a real app, this would be your template ID from the KYC provider's dashboard.
  const KYC_TEMPLATE_ID = 'tmpl_1234567890';

  const handleVerification = () => {
    setStatus('in_progress');

    const kycFlow = thirdPartyKycSDK.init({
      templateId: KYC_TEMPLATE_ID,
      onComplete: (inquiryId) => {
        // The client's job is done here. The backend will handle the result
        // via a webhook from the KYC provider. We just update the UI to
        // let the user know their submission was received.
        console.log(`Client received Inquiry ID: ${inquiryId}`);
        setStatus('submitted');
        toast({
            title: "Verification Submitted",
            description: "Your documents have been submitted for review. We'll notify you once the process is complete.",
        });
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
            description: error.message || "An unexpected error occurred during verification.",
            variant: "destructive",
        });
      },
    });

    kycFlow.open();
  };

  const renderContent = () => {
    switch (status) {
        case 'not_started':
        case 'failed':
            return (
                <>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 font-bold"><ShieldCheck /> Verify Your Identity</CardTitle>
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
                    <p className="text-muted-foreground">Your information is now under review. This usually takes just a few minutes. We'll email you and update your dashboard once it's complete.</p>
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
