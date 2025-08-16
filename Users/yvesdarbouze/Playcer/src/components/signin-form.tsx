
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithPopup } from "firebase/auth";
import { auth, twitterProvider } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Logo } from "./icons";

const TwitterIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
)

interface SignInFormProps {
    onSignInSuccess?: () => void;
}

export function SignInForm({ onSignInSuccess }: SignInFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleSocialSignIn = async () => {
    setIsLoading(true);
    try {
      await signInWithPopup(auth, twitterProvider);
      toast({
          title: "Sign-in Successful",
          description: "Welcome back!",
      });
      if(onSignInSuccess) {
          onSignInSuccess();
      } else {
        router.push("/dashboard");
      }
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
    <div className="w-full">
        <Button 
            variant="outline" 
            className="w-full"
            onClick={handleSocialSignIn} 
            disabled={isLoading}
        >
          {isLoading ? ( "Redirecting to Twitter..." ) : ( <> <TwitterIcon className="mr-2" /> Sign in with Twitter </> )}
        </Button>
        <div className="mt-4 text-center text-sm">
          No account?{" "}
          <Link href="/signup" className="underline">
            Sign up
          </Link>
        </div>
    </div>
  );
}
