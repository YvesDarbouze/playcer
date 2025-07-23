
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Logo } from "./icons";

// Placeholder icon for Google
const GoogleIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
        <path d="M12 15a6 6 0 0 0 6-6H6a6 6 0 0 0 6 6z"/>
        <path d="M12 2v3M12 22v-3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M2 12h3M22 12h-3M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12"/>
    </svg>
);


export function SignInForm() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleSocialSignIn = async () => {
    setIsLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      router.push("/");
    } catch (error: any) {
       toast({
        title: "Sign-in Failed",
        description: "Could not sign in at this time. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          <Logo className="size-12 text-primary" />
        </div>
        <CardTitle className="font-bold">Welcome to Playcer</CardTitle>
        <CardDescription>
          The peer-to-peer betting marketplace.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button 
            variant="outline" 
            className="w-full"
            onClick={handleSocialSignIn} 
            disabled={isLoading}
        >
          {isLoading ? ( "Redirecting to Google..." ) : ( <> <GoogleIcon className="mr-2" /> Sign in with Google </> )}
        </Button>
      </CardContent>
    </Card>
  );
}
