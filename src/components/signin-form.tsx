"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Twitter } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { getFirebaseAuth, getTwitterProvider } from "@/lib/firebase";
import { signInWithPopup } from "firebase/auth";
import { Logo } from "./icons";

export function SignInForm() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const handleSignIn = async () => {
    setIsLoading(true);
    try {
      const auth = getFirebaseAuth();
      const provider = getTwitterProvider();
      await signInWithPopup(auth, provider);
      // On successful sign-in, Firebase automatically handles the redirect.
      // For this app, we'll redirect to the home page.
      router.push("/");
    } catch (error: any) {
      console.error("Authentication error:", error);
      // Map Firebase auth errors to more user-friendly messages
      let description = "An unexpected error occurred. Please try again.";
      if (error.code === 'auth/popup-closed-by-user') {
        description = "You closed the sign-in window. Please try again.";
      } else if (error.code === 'auth/cancelled-popup-request') {
        description = "The sign-in process was cancelled. Please try again.";
      }
      toast({
        title: "Sign-In Failed",
        description,
        variant: "destructive",
      });
      setIsLoading(false);
    }
    // No need to setIsLoading(false) on success, as the page will redirect.
  };

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
            <Logo className="size-12 text-primary" />
        </div>
        <CardTitle className="text-2xl font-headline font-black">Welcome to Playcer</CardTitle>
        <CardDescription>
          Sign in to find and review pickleball courts.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          <Button
            onClick={handleSignIn}
            disabled={isLoading}
            variant="outline"
            className="w-full"
          >
            <Twitter className="mr-2 h-5 w-5 text-[#1DA1F2]" />
            {isLoading ? "Redirecting..." : "Sign in with Twitter"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
