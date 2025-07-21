
"use client";

import * as React from "react";
import { format } from "date-fns";
import type { Transaction } from "@/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Swords,
  Landmark,
} from "lucide-react";

interface TransactionsTableProps {
  transactions: Transaction[];
}

const getTransactionIcon = (type: Transaction["type"]) => {
  switch (type) {
    case "deposit":
      return <ArrowDownToLine className="text-green-500" />;
    case "withdrawal":
      return <ArrowUpFromLine className="text-red-500" />;
    case "bet_stake":
    case "bet_payout":
      return <Swords className="text-blue-500" />;
    case "commission":
      return <Landmark className="text-gray-500" />;
    default:
      return null;
  }
};

const getTransactionTitle = (type: Transaction["type"]) => {
  return type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
};

export function TransactionsTable({ transactions }: TransactionsTableProps) {
  if (transactions.length === 0) {
    return (
      <div className="p-6 text-center text-muted-foreground border rounded-lg">
        No transactions yet.
      </div>
    );
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Details</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((tx) => (
            <TableRow key={tx.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-muted rounded-full">
                    {getTransactionIcon(tx.type)}
                  </div>
                  <div>
                    <p className="font-medium">{getTransactionTitle(tx.type)}</p>
                    <Badge variant="outline">{tx.status}</Badge>
                  </div>
                </div>
              </TableCell>
              <TableCell>{format(new Date(tx.createdAt), "MMM d, yyyy")}</TableCell>
              <TableCell
                className={cn(
                  "text-right font-bold",
                  tx.amount > 0 ? "text-green-600" : "text-destructive"
                )}
              >
                {tx.amount > 0 ? "+" : ""}${tx.amount.toFixed(2)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
