
"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from 'next/navigation';
import { SidebarProvider, Sidebar, SidebarTrigger, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { Logo } from "@/components/icons";
import { Map, Trophy, User } from "lucide-react";

const menuItems = [
    { href: "/", label: "Map", icon: Map },
    { href: "/courts", label: "Courts", icon: Trophy },
    { href: "/profile", label: "Profile", icon: User },
];

export default function MainAppLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    return (
        <SidebarProvider>
            <Sidebar>
                <SidebarContent className="sidebar-bg sidebar-fg">
                    <SidebarHeader>
                        <div className="flex items-center gap-2">
                            <Logo className="size-8 text-primary" />
                            <span className="text-lg font-headline font-black">Playcer</span>
                        </div>
                    </SidebarHeader>
                    <SidebarMenu>
                        {menuItems.map((item) => (
                            <SidebarMenuItem key={item.href}>
                                <Link href={item.href} passHref legacyBehavior>
                                    <SidebarMenuButton asChild isActive={pathname === item.href} className="sidebar-ring hover:sidebar-accent hover:sidebar-accent-fg data-[active=true]:sidebar-accent data-[active=true]:sidebar-accent-fg">
                                        <a>
                                            <item.icon />
                                            <span>{item.label}</span>
                                        </a>
                                    </SidebarMenuButton>
                                </Link>
                            </SidebarMenuItem>
                        ))}
                    </SidebarMenu>
                </SidebarContent>
            </Sidebar>
            <main className="flex-1">
                <div className="md:hidden p-4">
                     <SidebarTrigger />
                </div>
                {children}
            </main>
        </SidebarProvider>
    );
}
