
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword, updateProfile, signInWithPopup } from "firebase/auth";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "./icons";
import { Chrome } from "lucide-react";


// Placeholder icon for Twitter
const TwitterIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M22 4s-.7 2.1-2 3.4c1.6 1.4 3.3 4.9 3.3 4.9s-5.2-.6-5.2-.6l-1.5-1.5s-2.3 2.7-4.8 2.7c-2.5 0-4.8-2.7-4.8-2.7S5 12.3 5 12.3s3.7-1.4 3.7-1.4L10 9.8s-1.8-2.2-1.8-2.2l-1.2-1.2S4.8 4 4.8 4s5.4 3.5 12.4 3.5c7 0 4.8-3.5 4.8-3.5z"/></svg>
);


export function SignUpForm() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isTwitterLoading, setIsTwitterLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({
        title: "Password Too Short",
        description: "Your password must be at least 6 characters long.",
        variant: "destructive",
      });
      return;
    }
    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      // The onUserCreate trigger will handle Firestore doc creation.
      // We just need to update the auth profile here.
      await updateProfile(userCredential.user, { displayName });
      router.push("/");
    } catch (error: any) {
      toast({
        title: "Sign-up Failed",
        description: error.code === 'auth/email-already-in-use' 
          ? "This email is already in use. Please sign in."
          : "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSocialSignIn = async (provider: 'google' | 'twitter') => {
    const socialProvider = provider === 'google' ? googleProvider : twitterProvider;
    const setLoading = provider === 'google' ? setIsGoogleLoading : setIsTwitterLoading;

    setLoading(true);
    try {
      await signInWithPopup(auth, socialProvider);
      router.push("/");
    } catch (error: any) {
       toast({
        title: "Sign-up Failed",
        description: "Could not sign up at this time. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          <Logo className="size-12 text-primary" />
        </div>
        <CardTitle className="text-2xl font-bold">Create an Account</CardTitle>
        <CardDescription>
          Join Playcer today to start placing bets with friends.
        </CardDescription>
      </CardHeader>
      <CardContent>
         <div className="grid grid-cols-2 gap-4">
            <Button variant="outline" onClick={() => handleSocialSignIn('twitter')} disabled={isLoading || isGoogleLoading || isTwitterLoading}>
             {isTwitterLoading ? ( "Signing in..." ) : ( <> <TwitterIcon className="mr-2" /> Twitter </> )}
            </Button>
            <Button variant="outline" onClick={() => handleSocialSignIn('google')} disabled={isLoading || isGoogleLoading || isTwitterLoading}>
              {isGoogleLoading ? ( "Signing in..." ) : ( <> <Chrome className="mr-2" /> Google </> )}
            </Button>
        </div>

        <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
            </div>
        </div>

        <form onSubmit={handleEmailSignUp} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              type="text"
              placeholder="Your Name"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={isLoading || isGoogleLoading || isTwitterLoading}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="m@example.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading || isGoogleLoading || isTwitterLoading}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input 
                id="password" 
                type="password" 
                required 
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading || isGoogleLoading || isTwitterLoading}
            />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading || isGoogleLoading || isTwitterLoading}>
            {isLoading ? "Creating Account..." : "Sign Up with Email"}
          </Button>
        </form>
        
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
