"use client";

import * as React from "react";
import { generateBusynessRating, type GenerateBusynessRatingOutput } from "@/ai/flows/generate-busyness-rating";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";

export function BusynessRating({ reviews }: { reviews: string[] }) {
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<GenerateBusynessRatingOutput | null>(null);
  const { toast } = useToast();

  const handleGenerate = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await generateBusynessRating({ reviews });
      setResult(res);
    } catch (e) {
      console.error(e);
      toast({
        title: "Error",
        description: "Failed to generate busyness rating.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
        <div className="flex items-center justify-between mb-2">
            <h2 className="font-headline font-black text-xl">AI Busyness Rating</h2>
            <Button onClick={handleGenerate} disabled={loading} size="sm">
                <Zap className="mr-2 h-4 w-4" />
                {loading ? "Generating..." : "Generate Rating"}
            </Button>
        </div>
      
        {loading && (
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-1/2" />
                    <Skeleton className="h-4 w-full mt-2" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-8 w-1/4" />
                </CardContent>
            </Card>
        )}

        {result && (
            <Card className="bg-accent/50 border-primary/20">
                <CardHeader>
                    <CardTitle className="flex items-center gap-4">
                        <span className="text-4xl font-headline font-black text-primary">{result.busynessRating.toFixed(1)}</span>
                        <div className="w-full">
                            <span className="text-sm font-bold">Busyness Level</span>
                            <Progress value={result.busynessRating * 20} className="h-2 mt-1" />
                        </div>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <CardDescription className="font-bold text-foreground">
                        {result.summary}
                    </CardDescription>
                </CardContent>
            </Card>
        )}
    </div>
  );
}
