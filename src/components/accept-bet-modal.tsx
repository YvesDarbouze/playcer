
"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { getFunctions, httpsCallable } from "firebase/functions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import type { Bet } from "@/types";
import { app } from "@/lib/firebase";
import { Loader2 } from "lucide-react";
import { useStripe, useElements, PaymentElement, Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';

interface AcceptBetModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  bet: Bet;
}

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

function AcceptBetModalInternal({ isOpen, onOpenChange, bet }: AcceptBetModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const stripe = useStripe();
  const elements = useElements();

  const [isLoading, setIsLoading] = React.useState(false);
  const [clientSecret, setClientSecret] = React.useState<string | null>(null);

  React.useEffect(() => {
      // If modal is opened, initiate the payment intent
      if (isOpen && user) {
          const initiateAcceptance = async () => {
              setIsLoading(true);
              const functions = getFunctions(app);
              const acceptBetFn = httpsCallable(functions, "acceptBet");
              try {
                  const result: any = await acceptBetFn({ betId: bet.id });
                  if (result.data.success && result.data.clientSecret) {
                      setClientSecret(result.data.clientSecret);
                  } else {
                      throw new Error(result.data.message || "Failed to initiate bet acceptance.");
                  }
              } catch (error: any) {
                  toast({ title: "Error", description: error.message, variant: "destructive" });
                  handleModalClose(false);
              } finally {
                  setIsLoading(false);
              }
          };
          initiateAcceptance();
      }
  }, [isOpen, user, bet.id, toast]);


  const handleFinalizeAcceptance = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements || !clientSecret) {
        toast({ title: "Error", description: "Stripe is not ready.", variant: "destructive" });
        return;
    }
    setIsLoading(true);
    
    const { error } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required'
    });
    
    if (error) {
        toast({ title: "Payment Failed", description: error.message, variant: "destructive" });
        setIsLoading(false);
    } else {
         toast({
            title: "Challenge Accepted!",
            description: "The bet is now active. Good luck!",
          });
         handleModalClose(false);
    }
  };

  const handleModalClose = (open: boolean) => {
    if (!open) {
      setClientSecret(null);
    }
    onOpenChange(open);
  };
  

  return (
    <Dialog open={isOpen} onOpenChange={handleModalClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Accept Challenge</DialogTitle>
          <DialogDescription>
            Authorize ${bet.totalWager.toFixed(2)} to accept this bet against @{bet.challengerUsername}. 
            Your payment method will only be charged if you lose.
          </DialogDescription>
        </DialogHeader>
        
        {isLoading && !clientSecret && (
            <div className="flex justify-center items-center h-24">
                <Loader2 className="animate-spin" />
            </div>
        )}

        {clientSecret && (
            <form onSubmit={handleFinalizeAcceptance}>
                <PaymentElement />
                <DialogFooter className="pt-4">
                    <Button type="button" variant="ghost" onClick={() => handleModalClose(false)}>Cancel</Button>
                    <Button type="submit" disabled={isLoading || !stripe}>
                        {isLoading ? <Loader2 className="animate-spin" /> : 'Confirm & Accept Bet'}
                    </Button>
                </DialogFooter>
            </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function AcceptBetModal(props: AcceptBetModalProps) {
    if (!props.isOpen) return null;
    return (
        <Elements stripe={stripePromise}>
            <AcceptBetModalInternal {...props} />
        </Elements>
    )
}
