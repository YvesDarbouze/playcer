"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Activity,
  Filter,
  Map,
  Swords,
  User,
} from "lucide-react";
import type { Court } from "@/types";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarInset,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Logo } from "@/components/icons";
import { CourtCard } from "@/components/court-card";
import { CourtDetails } from "@/components/court-details";
import { Slider } from "./ui/slider";
import { Checkbox } from "./ui/checkbox";
import { Label } from "./ui/label";
import { LoginButton } from "./login-button";

export function Dashboard({ courts: initialCourts }: { courts: Court[] }) {
  const [courts, setCourts] = React.useState<Court[]>(initialCourts);
  const [selectedCourt, setSelectedCourt] = React.useState<Court>(initialCourts[0]);

  // In a real app, filters would be more complex.
  const [ratingFilter, setRatingFilter] = React.useState([0]);
  const [busynessFilter, setBusynessFilter] = React.useState([5]);

  React.useEffect(() => {
    const filtered = initialCourts.filter(court => 
      court.rating >= ratingFilter[0] && court.busyness <= busynessFilter[0]
    );
    setCourts(filtered);
    if (filtered.length > 0) {
      setSelectedCourt(filtered[0]);
    } else {
      setSelectedCourt(initialCourts[0]);
    }
  }, [ratingFilter, busynessFilter, initialCourts]);


  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-2">
            <Logo className="size-8 text-primary" />
            <h1 className="font-headline font-black text-2xl text-sidebar-foreground">
              Playcer
            </h1>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Map" isActive>
                <Map />
                Map
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Courts">
                <Swords />
                Courts
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Activity">
                <Activity />
                Activity
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Profile">
                <User />
                Profile
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <div className="flex flex-col h-screen">
          <header className="p-4 border-b flex justify-between items-center">
            <h2 className="text-xl font-headline font-black">
              Find Your Court
            </h2>
            <LoginButton />
          </header>
          <div className="flex-1 grid md:grid-cols-12 overflow-hidden">
            <div className="md:col-span-4 lg:col-span-3 xl:col-span-3 border-r flex flex-col">
              <div className="p-4">
                <Input placeholder="Search courts..." />
              </div>
              <Tabs defaultValue="list" className="flex-1 flex flex-col overflow-hidden">
                <TabsList className="mx-4">
                  <TabsTrigger value="list" className="w-full">
                    List
                  </TabsTrigger>
                  <TabsTrigger value="filter" className="w-full">
                    <Filter className="mr-2" />
                    Filter
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="list" className="flex-1 overflow-hidden">
                   <ScrollArea className="h-full">
                    <div className="space-y-2 p-4 pt-0">
                      {courts.map((court) => (
                        <CourtCard
                          key={court.id}
                          court={court}
                          isSelected={selectedCourt?.id === court.id}
                          onClick={() => setSelectedCourt(court)}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>
                <TabsContent value="filter" className="p-4">
                  <div className="space-y-6">
                    <div>
                      <Label>Minimum Rating: {ratingFilter[0].toFixed(1)}</Label>
                      <Slider
                        defaultValue={[0]}
                        max={5}
                        step={0.1}
                        onValueChange={setRatingFilter}
                      />
                    </div>
                     <div>
                      <Label>Maximum Busyness: {busynessFilter[0]}</Label>
                      <Slider
                        defaultValue={[5]}
                        max={5}
                        step={1}
                        onValueChange={setBusynessFilter}
                      />
                    </div>
                    <div>
                        <h3 className="mb-2 font-bold">Features</h3>
                        <div className="space-y-2">
                           <div className="flex items-center space-x-2">
                                <Checkbox id="lights" />
                                <Label htmlFor="lights">Lights</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox id="restrooms" />
                                <Label htmlFor="restrooms">Restrooms</Label>
                            </div>
                             <div className="flex items-center space-x-2">
                                <Checkbox id="water" />
                                <Label htmlFor="water">Water Fountain</Label>
                            </div>
                        </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
            <div className="md:col-span-8 lg:col-span-9 xl:col-span-9 flex flex-col overflow-hidden">
              {selectedCourt ? (
                <CourtDetails court={selectedCourt} />
              ) : (
                <div className="flex-1 flex items-center justify-center bg-muted">
                  <p>Select a court to see details</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
