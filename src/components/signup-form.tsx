
"use client";

import { useState } from "react";
import Link from "next/link";
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


// Placeholder icon for Twitter
const TwitterIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M22 4s-.7 2.1-2 3.4c1.6 1.4 3.3 4.9 3.3 4.9s-5.2-.6-5.2-.6l-1.5-1.5s-2.3 2.7-4.8 2.7c-2.5 0-4.8-2.7-4.8-2.7S5 12.3 5 12.3s3.7-1.4 3.7-1.4L10 9.8s-1.8-2.2-1.8-2.2l-1.2-1.2S4.8 4 4.8 4s5.4 3.5 12.4 3.5c7 0 4.8-3.5 4.8-3.5z"/></svg>
);


export function SignUpForm() {
  const [isTwitterLoading, setIsTwitterLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  
  const handleSocialSignIn = async () => {
    setIsTwitterLoading(true);
    try {
      await signInWithPopup(auth, twitterProvider);
      router.push("/");
    } catch (error: any) {
       toast({
        title: "Sign-up Failed",
        description: "Could not sign up at this time. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsTwitterLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          <Logo className="size-12 text-primary" />
        </div>
        <CardTitle className="font-bold">Create an Account</CardTitle>
        <CardDescription>
          Join Playcer today by signing up with your Twitter account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button 
            variant="outline" 
            className="w-full" 
            onClick={handleSocialSignIn} 
            disabled={isTwitterLoading}>
            {isTwitterLoading ? ( "Redirecting to Twitter..." ) : ( <> <TwitterIcon className="mr-2" /> Sign Up with Twitter </> )}
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
