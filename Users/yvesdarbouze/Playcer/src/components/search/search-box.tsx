
"use client";

import { useSearchBox, useHits } from 'react-instantsearch';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Bet } from '@/types';

export function SearchBox(props: any) {
  const { query, refine } = useSearchBox(props);
  const { hits } = useHits<Bet>();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (betId: string) => {
    refine('');
    setIsOpen(false);
    router.push(`/bet/${betId}`);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
                type="search"
                placeholder="Search for teams, markets, users..."
                className="pl-10"
                value={query}
                onChange={(e) => {
                    refine(e.currentTarget.value);
                    if (e.currentTarget.value.length > 0) {
                        setIsOpen(true);
                    } else {
                        setIsOpen(false);
                    }
                }}
                autoFocus
            />
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandList>
                {hits.length > 0 && (
                    <CommandGroup heading="Bets">
                        {hits.map((hit) => (
                           <CommandItem key={hit.objectID} onSelect={() => handleSelect(hit.objectID)} value={`${hit.homeTeam} ${hit.awayTeam}`}>
                             <span>{hit.homeTeam} @ {hit.awayTeam}</span>
                           </CommandItem>
                        ))}
                    </CommandGroup>
                )}
                {query.length > 0 && hits.length === 0 && (
                     <CommandEmpty>No results found.</CommandEmpty>
                )}
            </CommandList>
          </Command>
      </PopoverContent>
    </Popover>
  );
}
