import * as React from "react";
import Image from "next/image";
import { Logo } from "./icons";

interface AuthLayoutProps {
  children: React.ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <main className="min-h-screen grid grid-cols-1 lg:grid-cols-2">
      <div className="hidden lg:flex flex-col items-center justify-center p-8 bg-primary-dark-blue text-background-offwhite relative">
        <Image
          src="https://placehold.co/1920x1080.png"
          alt="Abstract sports imagery"
          fill
          className="object-cover opacity-20"
          data-ai-hint="sports abstract"
        />
        <div className="z-10 text-center space-y-4">
          <Logo />
          <h1 className="text-4xl font-headline font-black">
            The Marketplace for Passionate Fans
          </h1>
          <p className="text-lg text-accent-peach max-w-md mx-auto">
            Challenge your friends, rivals, and fellow fans. No house, just head-to-head action.
          </p>
        </div>
      </div>
      <div className="flex items-center justify-center p-8 bg-muted/40">
        {children}
      </div>
    </main>
  );
}
