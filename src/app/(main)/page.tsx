
"use client";

import { useState } from 'react';
import { CourtCard } from "@/components/court-card";
import { CourtDetails } from "@/components/court-details";
import { courts as allCourts } from "@/lib/data";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

export default function HomePage() {
  const [selectedCourt, setSelectedCourt] = useState(allCourts[0]);
  const [searchTerm, setSearchTerm] = useState("");

  const filteredCourts = allCourts.filter(court =>
    court.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    court.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <ResizablePanelGroup direction="horizontal" className="h-screen w-full">
      <ResizablePanel defaultSize={30} minSize={20} maxSize={40}>
        <div className="flex flex-col h-full">
          <div className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search courts..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {filteredCourts.map((court) => (
                <CourtCard
                  key={court.id}
                  court={court}
                  isSelected={selectedCourt.id === court.id}
                  onClick={() => setSelectedCourt(court)}
                />
              ))}
            </div>
          </ScrollArea>
        </div>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={70}>
        {selectedCourt && <CourtDetails court={selectedCourt} />}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
