
# Playcer MVP Deployment Checklist

This guide outlines the final steps required in the Firebase Console and third-party services to make your Playcer application a functional Minimum Viable Product (MVP).

---

## 1. Configure Environment Variables (Secrets)

Your application's Cloud Functions require API keys to communicate with external services. These should be stored as secrets in Google Cloud Secret Manager, which Firebase Functions can access securely.

**Required Secrets:**

*   `ALGOLIA_APP_ID`: Your Algolia Application ID.
*   `ALGOLIA_API_KEY`: Your Algolia **Admin** API Key. This is used by the backend to write to your search index.
*   `ALGOLIA_SEARCH_ONLY_API_KEY`: Your Algolia **Search-Only** API Key. This is used to generate secure, temporary keys for frontend users.
*   `ODDS_API_KEY`: Your API key from [The Odds API](https://the-odds-api.com/) for fetching game data, odds, and scores.

**How to Set Secrets:**

You can set these secrets by running the following commands in your terminal from your project directory. Replace `your_actual_key_here` with the real keys from your service dashboards.

```bash
# Set Algolia Keys
firebase functions:secrets:set ALGOLIA_APP_ID
firebase functions:secrets:set ALGOLIA_API_KEY
firebase functions:secrets:set ALGOLIA_SEARCH_ONLY_API_KEY

# Set Odds API Key
firebase functions:secrets:set ODDS_API_KEY
```

After running each command, you will be prompted to enter the secret value. Once set, you must redeploy your functions for them to access the new secrets:

```bash
firebase deploy --only functions
```

---

## 2. Schedule the Bet Settlement Function

The `processBetOutcomes` function needs to run automatically to check for completed games and settle bets. You will use Google Cloud Scheduler to trigger this function.

**Steps to Create the Schedule:**

1.  Go to the **Google Cloud Console** for your Firebase project.
2.  Navigate to **Cloud Scheduler**.
3.  Click **Create Job**.
4.  **Define the job:**
    *   **Name:** `settle-completed-bets`
    *   **Frequency:** `*/15 * * * *` (This is a cron expression to run the job every 15 minutes).
    *   **Timezone:** Select your desired timezone (e.g., `America/New_York`).
5.  **Configure the execution:**
    *   **Target type:** `HTTP`
    *   **URL:** Get this from your Firebase Functions dashboard. It will look like `https://<your-region>-<your-project-id>.cloudfunctions.net/processBetOutcomes`.
    *   **HTTP method:** `POST`
    *   **Auth header:** Select `Add OIDC token`.
    *   **Service account:** Select a service account that has permission to invoke Cloud Functions (e.g., the default App Engine service account).

6.  Click **Create**. The scheduler will now automatically call your settlement function every 15 minutes.

---

## 3. Deploy Firestore Security Rules and Indexes

The `firestore.rules` and `firestore.indexes.json` files contain the necessary security rules and database indexes for your application. You need to deploy these rules to Firebase.

**How to Deploy:**

1.  Make sure you have the Firebase CLI installed.
2.  In your project's root directory, run the following command:

    ```bash
    firebase deploy --only firestore
    ```

This will apply the rules and indexes defined in your project files to your Firestore database.

---

## 4. Real-World Stripe Integration

This MVP uses a *placeholder* for Stripe payments. To process real payments, you would need to:

1.  Create a [Stripe](https://stripe.com/) account.
2.  Install the Stripe Node.js SDK in your `functions` directory: `npm install stripe`
3.  Replace the placeholder `paymentGateway` object in `functions/src/index.ts` with actual calls to the Stripe API for creating and managing PaymentIntents.
4.  Store your Stripe API keys securely as secrets, just like the other keys.
