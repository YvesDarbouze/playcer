
"use client";

import React, { useState, useEffect } from 'react';
import algoliasearch from 'algoliasearch/lite';
import { InstantSearch } from 'react-instantsearch';
import { SearchBox } from '@/components/search/search-box';
import { Hits } from '@/components/search/hits';
import { Skeleton } from '@/components/ui/skeleton';
import { useSearchParams } from 'next/navigation';

const appId = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID!;
const searchKey = process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_ONLY_API_KEY!;
const searchClient = algoliasearch(appId, searchKey);

function SearchPageInternal() {
    const searchParams = useSearchParams();
    const initialQuery = searchParams.get('q') || '';

    return (
         <InstantSearch
            searchClient={searchClient}
            indexName="bets"
            initialUiState={{
                bets: {
                    query: initialQuery,
                },
            }}
        >
            <header className="mb-8">
                <h1 className="text-4xl font-headline font-black">Search Bets</h1>
                <p className="text-muted-foreground">
                    Find public challenges matching teams, markets, or users.
                </p>
            </header>
            <div className="max-w-lg mb-8">
                <SearchBox />
            </div>
            <Hits />
        </InstantSearch>
    )
}


export default function SearchPage() {
    return (
        <main className="container mx-auto p-4 md:p-8">
           <React.Suspense fallback={<Skeleton className="h-96 w-full" />}>
                <SearchPageInternal />
           </React.Suspense>
        </main>
    );
}
