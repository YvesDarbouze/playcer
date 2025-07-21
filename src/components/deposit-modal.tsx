
"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface DepositModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

const depositSchema = z.object({
  amount: z.coerce
    .number()
    .min(5, "Deposit must be at least $5.00.")
    .max(1000, "Deposit cannot exceed $1,000.00."),
  paymentToken: z
    .string()
    .min(1, "A payment token is required.")
    .default("tok_placeholder"), // Placeholder for simulation
});

type DepositFormData = z.infer<typeof depositSchema>;

export function DepositModal({ isOpen, onOpenChange }: DepositModalProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);

  const form = useForm<DepositFormData>({
    resolver: zodResolver(depositSchema),
    defaultValues: {
      amount: 25,
      paymentToken: "tok_placeholder",
    },
  });

  const onSubmit = async (data: DepositFormData) => {
    setIsLoading(true);

    const functions = getFunctions(getFirebaseApp());
    const handleDeposit = httpsCallable(functions, "handleDeposit");

    try {
      const result: any = await handleDeposit({
        amount: data.amount,
        paymentToken: data.paymentToken,
      });

      if (result.data.success) {
        toast({
          title: "Deposit Successful!",
          description: `Successfully added $${data.amount.toFixed(
            2
          )} to your wallet.`,
        });
        onOpenChange(false); // Close modal on success
      } else {
        throw new Error(result.data.message || "Failed to process deposit.");
      }
    } catch (error: any) {
      console.error("Error processing deposit:", error);
      toast({
        title: "Deposit Error",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleModalClose = (open: boolean) => {
    if (!open) {
      form.reset();
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleModalClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Deposit Funds</DialogTitle>
          <DialogDescription>
            Add funds to your wallet using a secure payment method.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount ($)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="1.00"
                      placeholder="Enter amount"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {/* The payment token field would be hidden and populated by a real payment SDK */}
            <FormField
              control={form.control}
              name="paymentToken"
              render={({ field }) => (
                <FormItem className="hidden">
                  <FormLabel>Payment Token</FormLabel>
                  <FormControl>
                    <Input type="hidden" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading && <Loader2 className="mr-2 animate-spin" />}
                {isLoading
                  ? "Processing..."
                  : `Deposit $${form.watch("amount")?.toFixed(2) || "0.00"}`}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
