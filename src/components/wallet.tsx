
"use client";

import * as React from "react";
import type { User, Transaction } from "@/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Banknote, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { TransactionsTable } from "./transactions-table";
import { DepositModal } from "./deposit-modal";

interface WalletProps {
  user: User;
  transactions: Transaction[];
}

export function Wallet({ user, transactions }: WalletProps) {
  const [isDepositOpen, setIsDepositOpen] = React.useState(false);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-headline font-black">
            <Banknote /> My Wallet
          </CardTitle>
          <CardDescription>
            Manage your funds and view your transaction history.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-6 rounded-lg bg-gradient-to-r from-primary/80 to-primary text-primary-foreground shadow-lg flex justify-between items-center">
            <div>
              <p className="text-sm uppercase tracking-wider">Current Balance</p>
              <p className="text-4xl font-bold">
                ${user.walletBalance.toFixed(2)}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                variant="secondary"
                onClick={() => setIsDepositOpen(true)}
              >
                <ArrowDownCircle /> Deposit
              </Button>
              <Button variant="outline" disabled>
                <ArrowUpCircle /> Withdraw
              </Button>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-bold mb-2">Recent Transactions</h3>
            <TransactionsTable transactions={transactions} />
          </div>
        </CardContent>
      </Card>
      <DepositModal isOpen={isDepositOpen} onOpenChange={setIsDepositOpen} />
    </>
  );
}
