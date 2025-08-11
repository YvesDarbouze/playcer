
"use client";

import * as React from "react";
import Link from 'next/link';
import { Button } from "@/components/ui/button";

export function LoginButton() {
  // This is a placeholder. We will add full auth logic later.
  const user = null; 
  const loading = false;

  if (loading) {
    return <div className="h-10 w-24 bg-muted rounded-md animate-pulse" />;
  }

  if (!user) {
    return (
      <Link href="/login" passHref>
        <Button>Login</Button>
      </Link>
    );
  }

  return <div>Welcome!</div>;
}
