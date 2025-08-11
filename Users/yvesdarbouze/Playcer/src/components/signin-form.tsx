
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithPopup } from "firebase/auth";
import { auth, twitterProvider } from "@/lib/firebase";
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

const TwitterIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M22 4s-.7 2.1-2 3.4c1.6 1.4 3.3 4.4 3.3 4.4s-1.4 1.4-3.3 1.4c-1.9 0-3.3-1.4-3.3-1.4s-1.4 1.4-3.3 1.4c-1.9 0-3.3-1.4-3.3-1.4s-1.4 1.4-3.3 1.4c-1.9 0-3.3-1.4-3.3-1.4s-.7 2.1-2 3.4c1.6 1.4 3.3 4.4 3.3 4.4s-1.4 1.4-3.3 1.4c-1.9 0-3.3-1.4-3.3-1.4s-1.4 1.4-3.3 1.4c-1.9 0-3.3-1.4-3.3-1.4s-1.4 1.4-3.3 1.4c-1.9 0-3.3-1.4-3.3-1.4s-1.4 1.4-3.3 1.4c-1.9 0-3.3-1.4-3.3-1.4s-1.4 1.4-3.3 1.4c-1.9 0-3.3-1.4-3.3-1.4s-1.4 1.4-3.3 1.4c-1.9 0-3.3-1.4-3.3-1.4s-1.4 1.4-3.3 1.4c-1.9 0-3.3-1.4-3.3-1.4z"/>
    </svg>
)

export function SignInForm() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleSocialSignIn = async () => {
    setIsLoading(true);
    try {
      await signInWithPopup(auth, twitterProvider);
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
          <Logo/>
        </div>
        <CardTitle className="font-bold">Welcome Back</CardTitle>
        <CardDescription>
          Sign in with Twitter to access your dashboard.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
         <Button 
            variant="outline" 
            className="w-full"
            onClick={handleSocialSignIn} 
            disabled={isLoading}
        >
          {isLoading ? ( "Redirecting to Twitter..." ) : ( <> <TwitterIcon className="mr-2" /> Sign in with Twitter </> )}
        </Button>
      </CardContent>
    </Card>
  );
}
