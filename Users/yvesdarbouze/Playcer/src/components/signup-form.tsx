
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider, twitterProvider } from "@/lib/firebase";
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

const TwitterIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M22 4s-.7 2.1-2 3.4c1.6 1.4 3.3 4.4 3.3 4.4s-1.4 1.4-3.3 1.4c-1.9 0-3.3-1.4-3.3-1.4s-1.4 1.4-3.3 1.4c-1.9 0-3.3-1.4-3.3-1.4s-1.4 1.4-3.3 1.4c-1.9 0-3.3-1.4-3.3-1.4s-1.4 1.4-3.3 1.4c-1.9 0-3.3-1.4-3.3-1.4s-1.4 1.4-3.3 1.4c-1.9 0-3.3-1.4-3.3-1.4s-.7 2.1-2 3.4c1.6 1.4 3.3 4.4 3.3 4.4s-1.4 1.4-3.3 1.4c-1.9 0-3.3-1.4-3.3-1.4s-1.4 1.4-3.3 1.4c-1.9 0-3.3-1.4-3.3-1.4s-1.4 1.4-3.3 1.4c-1.9 0-3.3-1.4-3.3-1.4s-1.4 1.4-3.3 1.4c-1.9 0-3.3-1.4-3.3-1.4s-1.4 1.4-3.3 1.4c-1.9 0-3.3-1.4-3.3-1.4s-1.4 1.4-3.3 1.4c-1.9 0-3.3-1.4-3.3-1.4s-1.4 1.4-3.3 1.4c-1.9 0-3.3-1.4-3.3-1.4z"/>
    </svg>
)

export function SignUpForm() {
  const [isLoading, setIsLoading] = useState<false | 'google' | 'twitter'>(false);
  const router = useRouter();
  const { toast } = useToast();
  
  const handleSocialSignIn = async (provider: 'google' | 'twitter') => {
    setIsLoading(provider);
    const authProvider = provider === 'google' ? googleProvider : twitterProvider;
    try {
      await signInWithPopup(auth, authProvider);
      router.push("/");
    } catch (error: any) {
       toast({
        title: "Sign-up Failed",
        description: "Could not sign up at this time. Please try again.",
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
          <Logo />
        </div>
        <CardTitle className="font-bold">Create an Account</CardTitle>
        <CardDescription>
          Join Playcer today to challenge your friends.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
            variant="outline" 
            className="w-full" 
            onClick={() => handleSocialSignIn('google')} 
            disabled={!!isLoading}>
            {isLoading === 'google' ? ( "Redirecting to Google..." ) : ( <> <GoogleIcon className="mr-2" /> Sign up with Google </> )}
        </Button>
         <Button 
            variant="outline" 
            className="w-full" 
            onClick={() => handleSocialSignIn('twitter')} 
            disabled={!!isLoading}>
            {isLoading === 'twitter' ? ( "Redirecting to Twitter..." ) : ( <> <TwitterIcon className="mr-2" /> Sign up with Twitter </> )}
        </Button>
        
        <div className="mt-4 text-center text-sm">
          Already have an account?{" "}
          <Link href="/signin" className="underline">
            Sign in
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
