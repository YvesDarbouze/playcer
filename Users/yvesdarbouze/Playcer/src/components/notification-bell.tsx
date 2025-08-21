
"use client";

import * as React from "react";
import { useAuth } from "@/hooks/use-auth";
import { collection, query, where, onSnapshot, orderBy, limit, Timestamp } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { firestore, app } from "@/lib/firebase";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Bell, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Notification } from "@/types";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";

const functions = getFunctions(app);
const markNotificationsAsReadFn = httpsCallable(functions, "markNotificationsAsRead");

export function NotificationBell() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [notifications, setNotifications] = React.useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = React.useState(0);
    const [isOpen, setIsOpen] = React.useState(false);

    React.useEffect(() => {
        if (!user) {
            setNotifications([]);
            setUnreadCount(0);
            return;
        }

        const notificationsRef = collection(firestore, `users/${user.uid}/notifications`);
        const q = query(notificationsRef, orderBy("createdAt", "desc"), limit(20));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedNotifications: Notification[] = [];
            let count = 0;
            snapshot.forEach(doc => {
                const data = doc.data() as Omit<Notification, 'id'>;
                fetchedNotifications.push({ id: doc.id, ...data });
                if (!data.isRead) {
                    count++;
                }
            });
            setNotifications(fetchedNotifications);
            setUnreadCount(count);
        }, (error) => {
            console.error("Error fetching notifications: ", error);
            toast({ title: "Could not fetch notifications", variant: "destructive" });
        });

        return () => unsubscribe();
    }, [user, toast]);

    const handleOpenChange = async (open: boolean) => {
        setIsOpen(open);
        if (open && unreadCount > 0) {
            try {
                await markNotificationsAsReadFn();
            } catch (error) {
                console.error("Error marking notifications as read: ", error);
            }
        }
    }

    if (!user) {
        return null;
    }

    return (
        <Popover open={isOpen} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                    <Bell />
                    {unreadCount > 0 && (
                        <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs font-bold">
                            {unreadCount}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0">
                <div className="p-2 border-b">
                    <h3 className="font-medium text-sm">Notifications</h3>
                </div>
                {notifications.length > 0 ? (
                    <div className="flex flex-col max-h-96 overflow-y-auto">
                        {notifications.map(notif => (
                            <Link href={notif.link} key={notif.id} passHref>
                                <a className={cn(
                                    "p-3 hover:bg-accent block",
                                    !notif.isRead && "bg-primary/10"
                                )}>
                                    <p className="text-sm">{notif.message}</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {formatDistanceToNow(new Date((notif.createdAt as any).toDate()), { addSuffix: true })}
                                    </p>
                                </a>
                            </Link>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground text-center p-4">No new notifications.</p>
                )}
                 <div className="p-2 border-t text-center">
                    <Button variant="link" size="sm" className="w-full">
                        <CheckCheck className="mr-2"/> Mark All As Read
                    </Button>
                 </div>
            </PopoverContent>
        </Popover>
    );
}

