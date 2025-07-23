
import algoliasearch from 'algoliasearch/lite';

const appId = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID;
const apiKey = process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_ONLY_API_KEY;

if (!appId || !apiKey) {
    throw new Error("Algolia App ID and Search-only API Key must be provided in environment variables.");
}

export const searchClient = algoliasearch(appId, apiKey);

export const ALGOLIA_INDEX_NAME = 'bets';
