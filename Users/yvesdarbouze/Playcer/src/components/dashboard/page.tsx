
"use client";

import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { UserDashboard } from "@/components/user-dashboard";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/signin");
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
            <div className="w-full max-w-4xl space-y-8">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        </div>
    );
  }

  return (
    <main className="bg-muted/40">
        <UserDashboard />
    </main>
  );
}
