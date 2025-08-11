
"use client";

import Link from "next/link";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Logo } from "./icons";
import { LoginButton } from "./login-button";
import { Button } from "./ui/button";
import { Search, Bell, Check } from "lucide-react";
import { Input } from "./ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/hooks/use-auth";
import { collection, query, where, orderBy, onSnapshot, doc, writeBatch } from "firebase/firestore";
import { getFirestore, Timestamp } from "firebase/firestore";
import { getFirebaseApp } from "@/lib/firebase";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { getFunctions, httpsCallable } from 'firebase/functions';

type Notification = {
    id: string;
    title: string;
    message: string;
    betId?: string;
    createdAt: Timestamp;
    isRead: boolean;
};

const NotificationItem = ({ notification, onSelect }: { notification: Notification, onSelect: (betId?: string) => void }) => {
    return (
        <div 
            className={cn(
                "p-3 rounded-md transition-colors",
                notification.betId && "cursor-pointer hover:bg-muted"
            )}
            onClick={() => onSelect(notification.betId)}
        >
            <p className="font-bold">{notification.title}</p>
            <p className="text-sm text-muted-foreground">{notification.message}</p>
            <p className="text-xs text-muted-foreground mt-1">
                {formatDistanceToNow(notification.createdAt.toDate(), { addSuffix: true })}
            </p>
        </div>
    );
};

export function SiteHeader() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = React.useState("");
  const { user } = useAuth();
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [isPopoverOpen, setIsPopoverOpen] = React.useState(false);

  React.useEffect(() => {
    if (!user) {
        setNotifications([]);
        return;
    }

    const db = getFirestore(getFirebaseApp());
    const q = query(
      collection(db, "users", user.uid, "notifications"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const fetchedNotifications = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Notification[];
      setNotifications(fetchedNotifications);
    });

    return () => unsubscribe();
  }, [user]);

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (searchTerm.trim()) {
          router.push(`/search?q=${encodeURIComponent(searchTerm.trim())}`);
      }
  }

  const handleMarkAsRead = async () => {
    const unreadIds = notifications.filter(n => !n.isRead).map(n => n.id);
    if (unreadIds.length === 0) return;

    const functions = getFunctions(getFirebaseApp());
    const markAsReadFn = httpsCallable(functions, 'markNotificationsAsRead');
    try {
        await markAsReadFn({ notificationIds: unreadIds });
    } catch(error) {
        console.error("Error marking notifications as read:", error);
    }
  }
  
  React.useEffect(() => {
    if (isPopoverOpen) {
        handleMarkAsRead();
    }
  }, [isPopoverOpen]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const handleNotificationSelect = (betId?: string) => {
      if (betId) {
          router.push(`/bet/${betId}`);
          setIsPopoverOpen(false);
      }
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center">
        <div className="mr-4 flex items-center">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-6 text-sm md:flex">
            <Link
              href="/marketplace"
              className="transition-colors hover:text-foreground/80 text-foreground/80"
            >
              Marketplace
            </Link>
            <Link
              href="/dashboard"
              className="transition-colors hover:text-foreground/80 text-foreground/60"
            >
              Dashboard
            </Link>
            <Link
              href="/about"
              className="transition-colors hover:text-foreground/80 text-foreground/60"
            >
              About
            </Link>
          </nav>
        </div>
        
        <div className="flex flex-1 items-center justify-end space-x-2">
            <form onSubmit={handleSearchSubmit} className="relative w-full max-w-sm hidden md:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                    type="search"
                    placeholder="Search for events, teams, users..."
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </form>

            {user && (
                 <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                    <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" className="relative">
                            <Bell />
                            {unreadCount > 0 && (
                                <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
                                    {unreadCount}
                                </span>
                            )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0" align="end">
                        <div className="p-4">
                            <h3 className="text-lg font-medium">Notifications</h3>
                        </div>
                        <div className="max-h-96 overflow-y-auto">
                            {notifications.length > 0 ? (
                                notifications.map(n => <NotificationItem key={n.id} notification={n} onSelect={handleNotificationSelect} />)
                            ) : (
                                <p className="text-sm text-muted-foreground text-center p-4">You have no notifications.</p>
                            )}
                        </div>
                    </PopoverContent>
                </Popover>
            )}

            <LoginButton />
        </div>
      </div>
    </header>
  );
}
