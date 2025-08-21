
# Playcer MVP Deployment Checklist

This guide outlines the final steps required in the Firebase Console and third-party services to make your Playcer application a functional Minimum Viable Product (MVP).

---

## 1. Configure Environment Variables (Secrets & Client-side)

Your application uses two types of environment variables: secure backend secrets and public client-side configurations.

### A. Backend Secrets (Google Cloud Secret Manager)

Your application's Cloud Functions require API keys to communicate with external services. These MUST be stored as secrets in Google Cloud Secret Manager, which Firebase Functions can access securely at runtime.

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

### B. Frontend Configuration (Environment File)

Your Next.js frontend needs public keys for Firebase and Stripe. Create a file named `.env.local` in the root of your project directory (next to `package.json`). **This file should NOT be committed to git.**

**Contents of `.env.local`:**

```
# Firebase Client-side Configuration
NEXT_PUBLIC_FIREBASE_API_KEY="your-firebase-api-key"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your-project-id.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="your-project-id"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your-project-id.appspot.com"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="your-sender-id"
NEXT_PUBLIC_FIREBASE_APP_ID="your-app-id"

# Stripe Public Key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_live_yourStripePublishableKey"

# Google reCAPTCHA Enterprise Public Key
NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY="your-recaptcha-site-key"
```

**For Staging vs. Production:**
*   Use your **Production** Firebase project's config and **Live** Stripe key in your production deployment environment.
*   Use your **Staging** Firebase project's config and **Test** Stripe key in your staging environment.

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

---

## 5. Enable Firebase App Check

To protect your backend from abuse, you must enable App Check.

**Steps to Enable:**

1.  Go to the **Firebase Console**.
2.  In the left navigation pane, go to the **Build** section and click on **App Check**.
3.  Select the **Apps** tab and click on your web application.
4.  Click on **reCAPTCHA Enterprise** and follow the prompts to enable it. You may need to enable the reCAPTCHA Enterprise API in the Google Cloud Console.
5.  Once your site is registered, go to the **APIs** tab in the App Check section.
6.  Select **Cloud Functions** and click **Enforce**.
7.  Select **Cloud Firestore** and click **Enforce**.

After enforcement is enabled, only requests from your verified web application will be allowed to access your backend services.

---

## 6. Set Up Monitoring and Alerting

To ensure your application's reliability, set up monitoring and alerts in the Google Cloud Console.

**Steps to Configure:**

1.  Go to the **Google Cloud Console** for your Firebase project.
2.  Navigate to **Monitoring**.

**A. Create a Dashboard:**

1.  Go to **Dashboards** and click **Create Dashboard**.
2.  Add widgets for key metrics:
    *   **Cloud Function Invocations**: Track the number of times your key functions (`processBetOutcomes`, `stripeWebhook`, `createBet`) are being called.
    *   **Cloud Function Execution Time (p95/p99)**: Monitor the latency of your functions. High latency in `processBetOutcomes` could delay bet settlements.
    *   **Cloud Function Error Rate**: A chart showing the percentage of function executions that result in an error.

**B. Create Alerting Policies:**

1.  Go to **Alerting** and click **Create Policy**.
2.  **Alert on Function Errors:**
    *   **Metric**: `Cloud Function` -> `Executions`
    *   **Filter**: `status` = `error`
    *   **Aggregator**: `count`
    *   **Configuration**: Set a threshold, for example, "Alert if the count of errors is above 0 for 5 minutes." This will notify you immediately if any function starts failing.
3.  **Alert on High Latency:**
    *   **Metric**: `Cloud Function` -> `Execution Times`
    *   **Filter**: `function_name` = `processBetOutcomes`
    *   **Aggregator**: `99th percentile`
    *   **Configuration**: Set a threshold that makes sense for your application (e.g., "Alert if latency is above 10,000 ms for 10 minutes").
4.  **Create Log-Based Alerts for Critical Failures:**
    *   Go to **Logs Explorer** and create queries for specific failure messages you've logged in your functions.
    *   **Query for Stripe Failures**: `resource.type="cloud_function" AND severity=ERROR AND textPayload:"Failed to cancel Stripe Payment Intent"` or `"Failed to capture/release funds"`
    *   Click **Create Alert** from the query results.
    *   **Configuration**: Configure the alert to trigger whenever more than 0 log entries appear in a 5-minute window.
    *   Repeat this process for other critical error messages you want to be alerted on.
5.  **Configure Notification Channels**: For each policy, configure how you want to be notified (e.g., Email, Slack, PagerDuty).
