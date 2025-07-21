import Image from "next/image";
import { Star, Users } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Court } from "@/types";
import { cn } from "@/lib/utils";

interface CourtCardProps {
  court: Court;
  isSelected: boolean;
  onClick: () => void;
}

export function CourtCard({ court, isSelected, onClick }: CourtCardProps) {
  return (
    <Card
      className={cn(
        "cursor-pointer transition-all hover:shadow-md",
        isSelected ? "border-primary shadow-lg" : ""
      )}
      onClick={onClick}
    >
      <CardHeader className="p-0">
        <Image
          src={court.imageUrl}
          alt={court.name}
          width={400}
          height={200}
          className="rounded-t-lg object-cover w-full aspect-[2/1]"
          data-ai-hint="pickleball court"
        />
      </CardHeader>
      <CardContent className="p-4">
        <CardTitle className="text-lg font-headline font-black">
          {court.name}
        </CardTitle>
        <CardDescription>{court.address}</CardDescription>
        <div className="flex items-center justify-between mt-2 text-sm">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="flex items-center gap-1">
              <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
              <span>{court.rating.toFixed(1)}</span>
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1">
              <Users className="w-3 h-3 text-blue-500" />
              <span>{court.busyness}/5 Busy</span>
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
