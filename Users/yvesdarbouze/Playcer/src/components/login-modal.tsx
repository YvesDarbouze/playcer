
"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SignInForm } from "./signin-form";
import { Logo } from "./icons";

interface LoginModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function LoginModal({ isOpen, onOpenChange }: LoginModalProps) {
  const handleSuccess = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center items-center">
            <Logo />
          <DialogTitle className="font-bold text-2xl">Welcome Back</DialogTitle>
          <DialogDescription>
            Sign in to access your dashboard and manage your bets.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
            <SignInForm onSignInSuccess={handleSuccess} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
