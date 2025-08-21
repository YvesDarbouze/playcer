
# Playcer MVP Deployment Checklist

This guide outlines the final steps required in the Firebase Console and third-party services to make your Playcer application a functional Minimum Viable Product (MVP).

---

## 1. Configure Environment Variables (Secrets)

Your application's Cloud Functions require API keys to communicate with external services. These should be stored as secrets in Google Cloud Secret Manager, which Firebase Functions can access securely at runtime.

**Required Secrets:**

*   `ALGOLIA_APP_ID`: Your Algolia Application ID.
*   `ALGOLIA_API_KEY`: Your Algolia **Admin** API Key. This is used by the backend to write to your search index.
*   `ALGOLIA_SEARCH_ONLY_API_KEY`: Your Algolia **Search-Only** API Key. This is used for client-side search operations.
*   `ODDS_API_KEY`: Your API key from [The Odds API](https://the-odds-api.com/) for fetching game data, odds, and scores.
*   `STRIPE_API_KEY`: Your Stripe Secret Key for processing payments.
*   `STRIPE_WEBHOOK_SECRET`: Your Stripe webhook signing secret to verify incoming events.
*   `KYC_WEBHOOK_SECRET`: The signing secret from your KYC provider to verify identity webhooks (optional, for real KYC).

**How to Set Secrets:**

You can set these secrets by running the following commands in your terminal from your project directory. Replace `your_actual_key_here` with the real keys from your service dashboards. You will be prompted to enter the secret value after running each command.

```bash
# Set Algolia Keys
firebase functions:secrets:set ALGOLIA_APP_ID
firebase functions:secrets:set ALGOLIA_API_KEY
firebase functions:secrets:set ALGOLIA_SEARCH_ONLY_API_KEY

# Set Odds API Key
firebase functions:secrets:set ODDS_API_KEY

# Set Stripe Keys
firebase functions:secrets:set STRIPE_API_KEY
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET

# Set KYC Webhook Secret (if applicable)
firebase functions:secrets:set KYC_WEBHOOK_SECRET
```

After setting all secrets, you must redeploy your functions for them to access the new values:

```bash
firebase deploy --only functions
```

---

## 2. Schedule the Bet Settlement Function

The `processBetOutcomes` and `expirePendingBets` functions need to run automatically. Google Cloud Scheduler is automatically configured to trigger these functions when you deploy them.

**Verification Steps:**

1.  After deploying, go to the **Google Cloud Console** for your Firebase project.
2.  Navigate to **Cloud Scheduler**.
3.  You should see two jobs created by Firebase:
    *   `firebase-schedule-processBetOutcomes...`
    *   `firebase-schedule-expirePendingBets...`
4.  Confirm they are enabled and set to a frequency of every 15 minutes. No further action is needed.

---

## 3. Deploy Firestore Security Rules and Indexes

The `firestore.rules` and `firestore.indexes.json` files contain the necessary security rules and database indexes for your application. You need to deploy these to Firebase.

**How to Deploy:**

1.  Make sure you have the Firebase CLI installed.
2.  In your project's root directory, run the following command:

    ```bash
    firebase deploy --only firestore
    ```

This will apply the rules and indexes defined in your project files to your Firestore database.

---

## 4. Configure Stripe Webhook Endpoint

Stripe needs to send events to your `stripeWebhook` function.

**Steps to Configure:**

1.  After deploying, go to your **Firebase Functions dashboard** and find the URL for the `stripeWebhook` function. It will look like `https://<your-region>-<your-project-id>.cloudfunctions.net/stripeWebhook`.
2.  Go to your **Stripe Dashboard** -> **Developers** -> **Webhooks**.
3.  Click **Add an endpoint**.
4.  Paste the function URL into the **Endpoint URL** field.
5.  Click **+ Select events** and add the following events:
    *   `payment_intent.succeeded`
    *   `payment_intent.payment_failed`
    *   `payment_intent.requires_capture`
    *   `payment_intent.canceled`
6.  Click **Add endpoint**. Stripe will now send events to your function.

    