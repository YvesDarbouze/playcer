
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, signInWithPopup } from "firebase/auth";
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
import { Separator } from "@/components/ui/separator";
import { Logo } from "./icons";
import { Chrome } from "lucide-react";

// Placeholder icon for Twitter
const TwitterIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M22 4s-.7 2.1-2 3.4c1.6 1.4 3.3 4.9 3.3 4.9s-5.2-.6-5.2-.6l-1.5-1.5s-2.3 2.7-4.8 2.7c-2.5 0-4.8-2.7-4.8-2.7S5 12.3 5 12.3s3.7-1.4 3.7-1.4L10 9.8s-1.8-2.2-1.8-2.2l-1.2-1.2S4.8 4 4.8 4s5.4 3.5 12.4 3.5c7 0 4.8-3.5 4.8-3.5z"/></svg>
);


export function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isTwitterLoading, setIsTwitterLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/");
    } catch (error: any) {
      toast({
        title: "Sign-in Failed",
        description: "Please check your email and password and try again.",
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
        title: "Sign-in Failed",
        description: "Could not sign in at this time. Please try again.",
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
        <CardTitle className="text-2xl font-headline font-black">Welcome Back</CardTitle>
        <CardDescription>
          Sign in to your Playcer account to continue.
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

        <form onSubmit={handleEmailSignIn} className="grid gap-4">
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading || isGoogleLoading || isTwitterLoading}
            />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading || isGoogleLoading || isTwitterLoading}>
            {isLoading ? "Signing In..." : "Sign In with Email"}
          </Button>
        </form>

        <div className="mt-4 text-center text-sm">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="underline">
            Sign up
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
