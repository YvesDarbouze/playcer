
"use client";

import { useHits } from 'react-instantsearch';
import { MarketplaceBetCard } from '@/components/marketplace-bet-card';
import type { Bet } from '@/types';

export function Hits(props: any) {
  const { hits } = useHits<Bet>(props);

  if (hits.length === 0) {
    return (
        <div className="text-center py-16">
            <h2 className="text-xl font-semibold">No Bets Found</h2>
            <p className="text-muted-foreground mt-2">
                Your search did not match any open challenges.
            </p>
        </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {hits.map((hit) => (
        <MarketplaceBetCard key={hit.objectID} bet={{...hit, id: hit.objectID}} />
      ))}
    </div>
  );
}
