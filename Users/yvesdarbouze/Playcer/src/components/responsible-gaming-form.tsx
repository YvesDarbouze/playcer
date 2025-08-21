
"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { getFirestore, doc, updateDoc } from "firebase/firestore";
import { firestore } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import type { User } from "@/types";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Banknote, ShieldCheck, Moon } from "lucide-react";


const limitsSchema = z.object({
  depositDaily: z.coerce.number().min(0).optional(),
  depositWeekly: z.coerce.number().min(0).optional(),
  depositMonthly: z.coerce.number().min(0).optional(),
  wagerDaily: z.coerce.number().min(0).optional(),
  wagerWeekly: z.coerce.number().min(0).optional(),
  wagerMonthly: z.coerce.number().min(0).optional(),
});

type LimitsFormData = z.infer<typeof limitsSchema>;


export function ResponsibleGamingForm({ user }: { user: User }) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);
  const [exclusionDuration, setExclusionDuration] = React.useState("0");

  const form = useForm<LimitsFormData>({
    resolver: zodResolver(limitsSchema),
    defaultValues: {
      depositDaily: user.responsibleGamingLimits?.deposit?.daily || 0,
      depositWeekly: user.responsibleGamingLimits?.deposit?.weekly || 0,
      depositMonthly: user.responsibleGamingLimits?.deposit?.monthly || 0,
      wagerDaily: user.responsibleGamingLimits?.wager?.daily || 0,
      wagerWeekly: user.responsibleGamingLimits?.wager?.weekly || 0,
      wagerMonthly: user.responsibleGamingLimits?.wager?.monthly || 0,
    },
  });

  const onLimitsSubmit = async (data: LimitsFormData) => {
    setIsLoading(true);
    const userDocRef = doc(firestore, "users", user.id);

    try {
      await updateDoc(userDocRef, {
        "responsibleGamingLimits.deposit.daily": data.depositDaily,
        "responsibleGamingLimits.deposit.weekly": data.depositWeekly,
        "responsibleGamingLimits.deposit.monthly": data.depositMonthly,
        "responsibleGamingLimits.wager.daily": data.wagerDaily,
        "responsibleGamingLimits.wager.weekly": data.wagerWeekly,
        "responsibleGamingLimits.wager.monthly": data.wagerMonthly,
      });
      toast({
        title: "Success",
        description: "Your gaming limits have been updated.",
      });
    } catch (error) {
      console.error("Error updating limits:", error);
      toast({
        title: "Error",
        description: "Failed to update your limits. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelfExclusion = async () => {
     if (exclusionDuration === "0") {
         toast({ title: "Please select a duration.", variant: "destructive" });
         return;
     }
    setIsLoading(true);
    const userDocRef = doc(firestore, "users", user.id);

    const now = new Date();
    let exclusionEndDate: Date | null = new Date(now);
    
    switch (exclusionDuration) {
        case '24h': exclusionEndDate.setDate(now.getDate() + 1); break;
        case '7d': exclusionEndDate.setDate(now.getDate() + 7); break;
        case '30d': exclusionEndDate.setMonth(now.getMonth() + 1); break;
        case 'permanent': exclusionEndDate = null; break; // Indicates permanent
        default: exclusionEndDate = new Date(now);
    }

    try {
      await updateDoc(userDocRef, {
        "selfExclusion.isActive": true,
        "selfExclusion.startDate": now,
        "selfExclusion.endDate": exclusionEndDate,
      });
       toast({
        title: "Self-Exclusion Activated",
        description: "Your account is now in a cool-off period. You will be logged out.",
      });
      // In a real app, you would force a logout here.
    } catch (error) {
       console.error("Error setting self-exclusion:", error);
       toast({
        title: "Error",
        description: "Failed to activate self-exclusion. Please try again.",
        variant: "destructive",
      });
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-bold"><Banknote /> Set Your Limits</CardTitle>
          <CardDescription>
            Control your spending by setting deposit and wager limits. Set a value of 0 for no limit.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onLimitsSubmit)} className="space-y-6">
            <div>
              <h3 className="font-bold text-lg mb-2">Deposit Limits</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="depositDaily">Daily Limit ($)</Label>
                  <Input id="depositDaily" type="number" {...form.register("depositDaily")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="depositWeekly">Weekly Limit ($)</Label>
                  <Input id="depositWeekly" type="number" {...form.register("depositWeekly")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="depositMonthly">Monthly Limit ($)</Label>
                  <Input id="depositMonthly" type="number" {...form.register("depositMonthly")} />
                </div>
              </div>
            </div>
             <Separator />
            <div>
              <h3 className="font-bold text-lg mb-2">Wager Limits</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <div className="space-y-2">
                  <Label htmlFor="wagerDaily">Daily Wager Limit ($)</Label>
                  <Input id="wagerDaily" type="number" {...form.register("wagerDaily")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wagerWeekly">Weekly Wager Limit ($)</Label>
                  <Input id="wagerWeekly" type="number" {...form.register("wagerWeekly")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wagerMonthly">Monthly Wager Limit ($)</Label>
                  <Input id="wagerMonthly" type="number" {...form.register("wagerMonthly")} />
                </div>
              </div>
            </div>
            <Button type="submit" disabled={isLoading}>
                {isLoading ? "Saving..." : "Save Limits"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-bold"><Moon /> Self-Exclusion</CardTitle>
          <CardDescription>
            If you need to take a break, you can self-exclude from the platform.
            This action is irreversible for the selected duration.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row items-center gap-4">
            <div className="w-full md:w-1/2">
                <Label htmlFor="exclusionDuration">Select Duration</Label>
                <Select onValueChange={setExclusionDuration} defaultValue="0">
                    <SelectTrigger id="exclusionDuration">
                        <SelectValue placeholder="Choose a cool-off period" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="24h">24 Hours</SelectItem>
                        <SelectItem value="7d">7 Days</SelectItem>
                        <SelectItem value="30d">30 Days</SelectItem>
                        <SelectItem value="permanent">Permanent</SelectItem>
                    </SelectContent>
                </Select>
            </div>
           
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full md:w-auto mt-4 md:mt-0 self-end" disabled={exclusionDuration === '0'}>
                        Activate Self-Exclusion
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle className="font-bold">Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action cannot be undone. You will be locked out of your account and unable to
                        place bets for the entire duration you have selected.
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleSelfExclusion} disabled={isLoading}>
                        {isLoading ? "Activating..." : "Yes, I understand and want to proceed"}
                    </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </CardContent>
      </Card>
      
       <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-bold text-blue-900"><ShieldCheck className="text-blue-600" /> Need Help?</CardTitle>
          <CardDescription className="text-blue-800">
            If you or someone you know has a gambling problem, help is available. 
            Contact the National Council on Problem Gambling for confidential support.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <p className="font-bold">National Problem Gambling Helpline</p>
            <p>Call or Text: 1-800-522-4700</p>
            <a href="https://www.ncpgambling.org/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                ncpgambling.org
            </a>
        </CardContent>
      </Card>
    </div>
  );
}
