"use client";

import * as React from "react";
import { analyzeComments, type AnalyzeCommentsOutput } from "@/ai/flows/crowd-sourcing-comment-analyzer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquareQuote } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "./ui/badge";

export function AnalyzedComments({ comments, locationName }: { comments: string[], locationName: string }) {
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<AnalyzeCommentsOutput | null>(null);
  const { toast } = useToast();

  const handleAnalyze = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await analyzeComments({ comments, locationName });
      setResult(res);
    } catch (e) {
      console.error(e);
      toast({
        title: "Error",
        description: "Failed to analyze comments.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
        <div className="flex items-center justify-between mb-2">
            <h2 className="font-headline font-black text-xl">AI Crowdedness Analysis</h2>
            <Button onClick={handleAnalyze} disabled={loading} size="sm">
                <MessageSquareQuote className="mr-2 h-4 w-4" />
                {loading ? "Analyzing..." : "Find Crowdedness Comments"}
            </Button>
        </div>
      
        {loading && (
             <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
            </div>
        )}

        {result && (
            <Card>
                <CardHeader>
                    <CardTitle>Relevant Comments</CardTitle>
                    <CardDescription>
                        These comments were flagged by AI as being related to how crowded the courts are.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {result.crowdednessComments.length > 0 ? (
                        <div className="space-y-3">
                        {result.crowdednessComments.map((comment, index) => (
                            <div key={index} className="border-l-4 border-primary pl-4 py-2 bg-accent/50 rounded-r-md">
                                <p className="italic text-foreground">"{comment}"</p>
                            </div>
                        ))}
                        </div>
                    ) : (
                        <p className="text-muted-foreground">No comments about crowdedness found.</p>
                    )}
                </CardContent>
            </Card>
        )}
    </div>
  );
}
