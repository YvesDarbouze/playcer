
"use client";

import * as React from "react";
import { getFirestore, collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { firestore } from "@/lib/firebase";
import type { User } from "@/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "./ui/avatar";
import { Skeleton } from "./ui/skeleton";
import { cn } from "@/lib/utils";

interface RankingTableProps {
    currentUserId: string;
}

export function RankingTable({ currentUserId }: RankingTableProps) {
  const [users, setUsers] = React.useState<User[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      const usersRef = collection(firestore, "users");
      const q = query(usersRef, orderBy("wins", "desc"), limit(100));
      
      const querySnapshot = await getDocs(q);
      const fetchedUsers = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
      setUsers(fetchedUsers);
      setLoading(false);
    };

    fetchUsers();
  }, []);

  if (loading) {
      return (
          <Card>
              <CardHeader>
                  <CardTitle>Global Leaderboard</CardTitle>
                  <CardDescription>Top 100 players on Playcer, ranked by wins.</CardDescription>
              </CardHeader>
              <CardContent>
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
              </CardContent>
          </Card>
      )
  }

  return (
    <Card>
        <CardHeader>
            <CardTitle>Global Leaderboard</CardTitle>
            <CardDescription>Top 100 players on Playcer, ranked by wins.</CardDescription>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                <TableRow>
                    <TableHead className="w-[80px]">Rank</TableHead>
                    <TableHead>Player</TableHead>
                    <TableHead className="text-center">Wins</TableHead>
                    <TableHead className="text-center">Losses</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {users.map((user, index) => (
                    <TableRow key={user.id} className={cn(user.id === currentUserId && "bg-primary/10")}>
                        <TableCell className="font-bold text-lg">{index + 1}</TableCell>
                        <TableCell>
                            <div className="flex items-center gap-3">
                                <Avatar className="size-8">
                                    <AvatarImage src={user.photoURL} alt={user.displayName} />
                                    <AvatarFallback>{user.username.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="font-medium">{user.displayName}</p>
                                    <p className="text-xs text-muted-foreground">@{user.username}</p>
                                </div>
                            </div>
                        </TableCell>
                        <TableCell className="text-center font-bold text-green-500">{user.wins}</TableCell>
                        <TableCell className="text-center font-bold text-red-500">{user.losses}</TableCell>
                    </TableRow>
                ))}
                </TableBody>
            </Table>
        </CardContent>
    </Card>
  );
}
