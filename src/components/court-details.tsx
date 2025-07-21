import Image from "next/image";
import { MapPin, Star } from "lucide-react";
import type { Court } from "@/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { BusynessRating } from "./busyness-rating";
import { AnalyzedComments } from "./analyzed-comments";

interface CourtDetailsProps {
  court: Court;
}

export function CourtDetails({ court }: CourtDetailsProps) {
  return (
    <ScrollArea className="h-full">
      <div className="p-6">
        <div className="relative mb-4">
          <Image
            src={court.imageUrl}
            alt={court.name}
            width={800}
            height={400}
            className="rounded-lg object-cover w-full aspect-video"
            data-ai-hint="pickleball court"
          />
          <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-black/80 to-transparent rounded-b-lg p-4 flex flex-col justify-end">
            <h1 className="font-headline font-black text-3xl text-white shadow-lg">
              {court.name}
            </h1>
            <p className="text-white/90 flex items-center gap-2 mt-1">
              <MapPin className="w-4 h-4" />
              {court.address}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="mb-4">
              <h2 className="font-headline font-black text-xl mb-2">Features</h2>
              <div className="flex flex-wrap gap-2">
                {court.features.map((feature) => (
                  <Badge key={feature} variant="secondary">{feature}</Badge>
                ))}
              </div>
            </div>

            <Separator className="my-6" />

            <div className="mb-4">
                <BusynessRating reviews={court.reviews.map(r => r.comment)} />
            </div>

            <Separator className="my-6" />

            <div>
                <AnalyzedComments comments={court.reviews.map(r => r.comment)} locationName={court.name} />
            </div>
            
          </div>
          <div className="lg:col-span-1">
            <div className="bg-muted rounded-lg p-4">
              <h3 className="font-headline font-black text-lg mb-4">User Reviews</h3>
              <div className="space-y-4">
                {court.reviews.map((review, index) => (
                  <div key={index}>
                    <div className="flex items-center justify-between">
                      <p className="font-bold">{review.author}</p>
                      <div className="flex items-center gap-1">
                        {[...Array(review.rating)].map((_, i) => (
                          <Star key={i} className="w-4 h-4 text-amber-500 fill-amber-500" />
                        ))}
                        {[...Array(5-review.rating)].map((_, i) => (
                          <Star key={i} className="w-4 h-4 text-muted-foreground/50" />
                        ))}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{review.comment}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
