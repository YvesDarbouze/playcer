
"use client";

import React, { useState, useEffect } from 'react';
import algoliasearch from 'algoliasearch/lite';
import { InstantSearch } from 'react-instantsearch';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import { SearchBox } from '@/components/search/search-box';
import { Hits } from '@/components/search/hits';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from 'lucide-react';

const functions = getFunctions(app);
const getAlgoliaSearchKey = httpsCallable(functions, 'getAlgoliaSearchKey');

const appId = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID;
const publicSearchOnlyApiKey = process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_ONLY_API_KEY;

export default function SearchPage() {
    const { user } = useAuth();
    const [searchClient, setSearchClient] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!appId || !publicSearchOnlyApiKey) {
            setLoading(false);
            return;
        }

        const createSearchClient = async () => {
            if (user) {
                try {
                    const result: any = await getAlgoliaSearchKey();
                    const searchKey = result.data.key;
                    setSearchClient(algoliasearch(appId, searchKey));
                } catch (error) {
                    console.error("Error fetching Algolia search key:", error);
                    setSearchClient(algoliasearch(appId, publicSearchOnlyApiKey));
                }
            } else {
                 setSearchClient(algoliasearch(appId, publicSearchOnlyApiKey));
            }
            setLoading(false);
        };

        createSearchClient();
    }, [user]);

    if (loading) {
        return (
            <div className="container mx-auto p-4 md:p-8">
                <Skeleton className="h-12 w-1/3 mb-8" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}
                </div>
            </div>
        );
    }

    if (!appId || !publicSearchOnlyApiKey || !searchClient) {
        return (
            <main className="container mx-auto p-4 md:p-8">
                 <Alert>
                    <Terminal className="h-4 w-4" />
                    <AlertTitle>Algolia Not Configured</AlertTitle>
                    <AlertDescription>
                        Please set the `NEXT_PUBLIC_ALGOLIA_APP_ID` and `NEXT_PUBLIC_ALGOLIA_SEARCH_ONLY_API_KEY` environment variables to enable search.
                    </AlertDescription>
                </Alert>
            </main>
        )
    }

    return (
        <main className="container mx-auto p-4 md:p-8">
            <InstantSearch
                searchClient={searchClient}
                indexName="bets"
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
        </main>
    );
}
