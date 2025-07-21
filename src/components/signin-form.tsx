"use client";

import { Twitter } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Logo } from "./icons";
import { LoginButton } from "./login-button";

export function SignInForm() {

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
            <Logo className="size-12 text-primary" />
        </div>
        <CardTitle className="text-2xl font-headline font-black">Welcome to Playcer</CardTitle>
        <CardDescription>
          The social betting platform. Sign in to get started.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          <LoginButton />
        </div>
      </CardContent>
    </Card>
  );
}
