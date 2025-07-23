
"use client";

import React, { useState, useEffect } from 'react';
import algoliasearch from 'algoliasearch/lite';
import { InstantSearch } from 'react-instantsearch';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getFirebaseApp } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import { SearchBox } from '@/components/search/search-box';
import { Hits } from '@/components/search/hits';
import { Skeleton } from '@/components/ui/skeleton';

const functions = getFunctions(getFirebaseApp());
const getAlgoliaSearchKey = httpsCallable(functions, 'getAlgoliaSearchKey');

const appId = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID!;

export default function SearchPage() {
    const { user } = useAuth();
    const [searchClient, setSearchClient] = useState<any>(null);

    useEffect(() => {
        const createSearchClient = async () => {
            if (user) {
                try {
                    const result: any = await getAlgoliaSearchKey();
                    const searchKey = result.data.key;
                    setSearchClient(algoliasearch(appId, searchKey));
                } catch (error) {
                    console.error("Error fetching Algolia search key:", error);
                    // Fallback to a search-only key if the function fails
                    setSearchClient(algoliasearch(appId, process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_ONLY_API_KEY!));
                }
            } else {
                 // For logged-out users, use the public search-only key
                 setSearchClient(algoliasearch(appId, process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_ONLY_API_KEY!));
            }
        };

        createSearchClient();
    }, [user]);

    if (!searchClient) {
        return (
            <div className="container mx-auto p-4 md:p-8">
                <Skeleton className="h-12 w-1/3 mb-8" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}
                </div>
            </div>
        );
    }

    return (
        <main className="container mx-auto p-4 md:p-8">
            <InstantSearch
                searchClient={searchClient}
                indexName="bets"
                insights
            >
                <header className="mb-8">
                    <h1 className="text-4xl font-headline font-black">Search Bets</h1>
                    <p className="text-muted-foreground">
                        Find public challenges matching teams, markets, or users.
                    </p>
                </header>
                <SearchBox />
                <Hits />
            </InstantSearch>
        </main>
    );
}
