
"use client";

import Link from "next/link";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Logo } from "./icons";
import { LoginButton } from "./login-button";
import { Button } from "./ui/button";
import { Search, Bot, Bell } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import algoliasearch from "algoliasearch/lite";
import { InstantSearch } from "react-instantsearch";
import { SearchBox } from "./search/search-box";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { collection, query, where, orderBy, onSnapshot, doc, writeBatch, Timestamp } from "firebase/firestore";
import { firestore, app } from "@/lib/firebase";
import { getFunctions, httpsCallable } from 'firebase/functions';
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

const searchClient = algoliasearch(
  process.env.NEXT_PUBLIC_ALGOLIA_APP_ID!,
  process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_ONLY_API_KEY!
);

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
  const { user } = useAuth();
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [isPopoverOpen, setIsPopoverOpen] = React.useState(false);

  React.useEffect(() => {
    if (!user) {
        setNotifications([]);
        return;
    }

    const q = query(
      collection(firestore, "users", user.uid, "notifications"),
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

  const handleMarkAsRead = async () => {
    const unreadIds = notifications.filter(n => !n.isRead).map(n => n.id);
    if (unreadIds.length === 0 || !user) return;

    const functions = getFunctions(app);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
             <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="transition-colors hover:text-foreground/80 text-foreground/60 px-0">
                        Dev Tools
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => router.push('/dev/odds-checker')}>
                        <Bot className="mr-2 h-4 w-4" />
                        <span>Game Ingestion Checker</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push('/dev/arbitrage-finder')}>
                         <Bot className="mr-2 h-4 w-4" />
                        <span>Arbitrage Finder</span>
                    </DropdownMenuItem>
                     <DropdownMenuItem onClick={() => router.push('/dev/consensus-checker')}>
                         <Bot className="mr-2 h-4 w-4" />
                        <span>Consensus Checker</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            <Link
              href="/about"
              className="transition-colors hover:text-foreground/80 text-foreground/60"
            >
              About
            </Link>
          </nav>
        </div>
        
        <div className="flex flex-1 items-center justify-end space-x-2">
            <div className="relative w-full max-w-sm hidden md:block">
                <InstantSearch
                  searchClient={searchClient}
                  indexName="bets"
                >
                  <SearchBox />
                </InstantSearch>
            </div>
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
