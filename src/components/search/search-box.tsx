
"use client";

import { useSearchBox } from 'react-instantsearch';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

export function SearchBox(props: any) {
  const { query, refine } = useSearchBox(props);

  return (
    <div className="relative w-full max-w-lg mb-8">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
      <Input
        type="search"
        placeholder="Search for teams, markets, or users..."
        className="pl-10 text-lg"
        value={query}
        onChange={(e) => refine(e.currentTarget.value)}
        autoFocus
      />
    </div>
  );
}
