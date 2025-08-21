
# Playcer MVP: Technical Overview & Roadmap

**To:** Incoming CTO & Director of Web Ops  
**From:** The Development Team  
**Date:** August 21, 2025  
**Re:** Current State and Path to MVP for the Playcer Application

## 1. Executive Summary

This document provides a comprehensive technical overview of the Playcer application. Playcer is a peer-to-peer (P2P) sports betting platform built on a modern, scalable technology stack. Its core architecture is designed to support real-time odds updates, secure transactions, and a robust feature set for a social betting experience. The application has a solid foundation, with many key user-facing features already developed. This report outlines the current architecture, the features we have implemented, and a clear roadmap of the remaining tasks required to achieve a secure, functional, and successful Minimum Viable Product (MVP).

---

## 2. Application Architecture Diagram

Playcer's architecture is built around a Next.js frontend, a serverless Firebase backend, and integrations with essential third-party services for payments and sports data.

```mermaid
flowchart TD
    subgraph "User's Device"
        A[User's Browser]
    end

    subgraph "Frontend (Next.js on Firebase App Hosting)"
        B[Next.js App]
        B1[Landing Page]
        B2[Game/Betting Pages]
        B3[User Dashboard]
        B4[Admin Panel]
    end

    subgraph "Backend (Firebase)"
        C[Firebase Auth]
        D[Cloud Firestore]
        E[Cloud Functions for Firebase]
        F[Firebase Storage]
    end

    subgraph "Third-Party Services"
        G[Sports Game Odds API]
        H[Stripe API]
        I[Algolia Search]
    end

    A <-->|HTTPS| B
    B <-->|SDK| C
    B <-->|SDK (Real-time read)| D
    B <-->|Callable Functions| E
    B3 -->|Uploads| F

    E -->|Read/Write| D
    E -->|Admin SDK| C
    E -->|Admin SDK| F
    E -->|REST API| G
    E -->|SDK/API| H
    E -->|Admin SDK| I

    G -- "Real-time Odds (Pusher)" --> E
    H -- "Webhooks" --> E
```

**Flow Description:**

1.  **User Interaction**: The user accesses the **Next.js App**, which serves all frontend pages and components.
2.  **Authentication**: **Firebase Auth** handles user sign-up, login (via Twitter), and session management.
3.  **Data Display**: The frontend reads game and odds data directly from **Cloud Firestore** in real-time. This provides a fast, responsive experience.
4.  **Core Logic**: All sensitive actions (creating/accepting bets, processing payments) are handled by **Cloud Functions**. The frontend invokes these functions securely.
5.  **Data Ingestion**: A dedicated Cloud Function (`stream.ts`) maintains a persistent connection to the **Sports Game Odds API**'s real-time feed, ingesting game and odds data into Firestore as it arrives. Another scheduled function handles bet settlement.
6.  **Payments**: **Stripe** is used for payment processing. Cloud Functions create payment intents, and Stripe webhooks notify our backend of transaction outcomes.
7.  **Search**: **Algolia** powers the search functionality for finding public bets, teams, or users. Cloud Functions keep the Algolia index in sync with the Firestore database.

---

## 3. Technology Stack

*   **Framework**: Next.js (with App Router)
*   **Language**: TypeScript
*   **Styling**: Tailwind CSS with ShadCN UI components
*   **Backend**: Firebase (Serverless)
    *   **Database**: Cloud Firestore
    *   **Authentication**: Firebase Authentication (Twitter provider)
    *   **Serverless Functions**: Cloud Functions for Firebase (Node.js)
    *   **Hosting**: Firebase App Hosting
    *   **File Storage**: Firebase Storage (for user profile pictures)
*   **Key APIs & Services**:
    *   **Sports Data**: Sports Game Odds API
    *   **Payments**: Stripe
    *   **Search**: Algolia

---

## 4. Developed Pages & Features

The following pages and core features have been implemented:

*   **User Authentication**:
    *   Sign-up and Sign-in with Twitter (`/signup`, `/signin`).
    *   Session management and protected routes.
*   **Core Betting Pages**:
    *   **Homepage / Game List (`/`)**: Displays a list of upcoming games fetched from Firestore.
    *   **Game Details Page (`/game/[gameId]`)**: Shows detailed odds for a specific game, allowing users to initiate a bet.
    *   **Bet Challenge Page (`/bet/[betId]`)**: A shareable page where a user can view and accept a specific bet challenge.
    *   **Bet Creation Modal**: A multi-step form for creating a new bet with specific terms.
*   **User Dashboard (`/dashboard`)**:
    *   Displays user stats (wins, losses, wallet balance).
    *   Tabs for viewing active, pending, and historical bets.
    *   Profile picture uploads.
*   **Marketplace & Search**:
    *   **Marketplace (`/marketplace`)**: A feed of all public, open bets that any user can accept.
    *   **Search Page (`/search`)**: Algolia-powered search for bets, users, and teams.
*   **Developer & Admin Tools**:
    *   A suite of developer pages (`/dev/*`) for checking API integrations (Odds, Consensus, Arbitrage).

---

## 5. Path to MVP

The following items are critical for transitioning Playcer from its current state to a functional, secure, and reliable MVP ready for public launch.

**1. Finalize Backend Logic & Security:**
-   [ ] **Bet Settlement Function**: The `processBetOutcomes` function needs to be rigorously tested and scheduled to run automatically (e.g., every 15 minutes) using Cloud Scheduler.
-   [ ] **Real-World Payment Integration**: Replace the placeholder payment logic with actual calls to the Stripe API for capturing and releasing payments based on bet outcomes.
-   [ ] **Secure API Keys**: All third-party API keys (`Stripe`, `Algolia`, `Odds API`) must be stored as secrets in Google Cloud Secret Manager, not in environment variables.

**2. Enhance Regulatory & Compliance Features:**
-   [ ] **KYC (Know Your Customer) Integration**: Implement a real KYC provider flow (e.g., Stripe Identity, Persona) to replace the current placeholder. The `kycWebhook` needs to be connected to the provider's system.
-   [ ] **Responsible Gaming Features**: While the UI is present, the backend logic to enforce deposit and wager limits needs to be fully implemented and tested.
-   [ ] **Geolocation Enforcement**: Add strict geolocation checks within critical Cloud Functions to ensure bets are only placed from permitted jurisdictions.

**3. Improve User Experience & Notifications:**
-   [ ] **Real-time Notifications**: Implement a system (e.g., using a Firestore listener and a notification service) to alert users when their bet is accepted, settled, or when it's their turn to act.
-   [ ] **Dispute Resolution Flow**: Build out the admin-facing UI for resolving user-submitted disputes over bet outcomes.

**4. Finalize Deployment & Operations:**
-   [ ] **Deploy Firestore Rules & Indexes**: The `firestore.rules` and `firestore.indexes.json` files must be deployed to production.
-   [ ] **Set Up Monitoring & Logging**: Configure alerts in Google Cloud / Firebase for function errors, high latency, or unusual activity.
-   [ ] **Comprehensive Testing**: Conduct end-to-end testing, including the full payment and betting lifecycle, on a staging environment before deploying to production.

By completing these steps, we will have a robust, secure, and scalable MVP that is ready for launch.
