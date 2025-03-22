# Stripe Payment Server

A dedicated Express.js server for handling Stripe payments, subscriptions, and Firebase integration for the SaudePilates app.

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Configure environment variables:
   - Copy `.env.example` to `.env` (if not already done)
   - Add your Stripe secret keys to `STRIPE_SECRET_KEY_DEV` and `STRIPE_SECRET_KEY_PROD`
   - Add your Stripe webhook secrets to `STRIPE_WEBHOOK_SECRET_DEV` and `STRIPE_WEBHOOK_SECRET_PROD`
   - Add your Stripe product IDs for each subscription plan
   - Add your Firebase service account credentials
   - Set `NODE_ENV` to `development` or `production` to switch environments
   - Set `PORT` if you want to use a port other than 3000

3. Start the server:
   ```
   npm start
   ```

   For development with auto-reload:
   ```
   npm run dev
   ```

## Firebase Integration

This server integrates with Firebase Firestore to:

1. Retrieve the company ID associated with a user's email
2. Update subscription status for companies when payments are processed

When a Stripe webhook event is received:
- The server extracts the customer's email from the event
- It finds the user record in Firebase with that email
- It gets the company ID associated with that user
- It updates the subscription document for that company with the new subscription details

Subscription documents are stored in the `subscriptions` collection in Firestore, with the company ID as the document ID.

### Required Firebase Service Account

To use the Firebase Admin SDK, you need to add your service account credentials to the `.env` file:

```
FIREBASE_CLIENT_EMAIL=your-service-account@project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour Private Key Here\n-----END PRIVATE KEY-----\n"
```

To get your service account credentials:
1. Go to the Firebase Console > Project Settings > Service Accounts
2. Click "Generate new private key"
3. Use the values from the downloaded JSON file in your `.env` file

## API Endpoints

### Payment Intent (for custom payment flows)

```
POST /create-payment-intent
```