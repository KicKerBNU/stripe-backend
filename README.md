# Stripe Backend

A serverless backend for handling Stripe payments and webhooks, ready for Netlify deployment.

## Features

- Stripe checkout session creation
- Webhook handling for payment events
- Firebase integration for subscription management
- Production-ready configuration

## Deployment Instructions for Netlify

1. Push your code to GitHub
2. Create a new site in Netlify connected to your GitHub repository
3. Configure the following build settings:
   - Build command: `npm run build`
   - Publish directory: `public`

4. Set up the required environment variables in Netlify:
   - `NODE_ENV` - Set to "production"
   - `STRIPE_SECRET_KEY_PROD` - Your Stripe production secret key
   - `STRIPE_WEBHOOK_SECRET_PROD` - Your Stripe production webhook secret
   - `FIREBASE_PRIVATE_KEY` - Your Firebase service account private key
   - `FIREBASE_CLIENT_EMAIL` - Your Firebase service account client email
   - `STRIPE_PRODUCT_ID_ANUAL` - Your Stripe annual plan product ID
   - `STRIPE_PRODUCT_ID_TRIMESTRAL` - Your Stripe quarterly plan product ID
   - `STRIPE_PRODUCT_ID_MENSAL` - Your Stripe monthly plan product ID

5. After deployment, your API endpoints will be available at:
   - Webhook: `https://your-netlify-site.netlify.app/api/webhook`
   - Create checkout session: `https://your-netlify-site.netlify.app/api/create-checkout-session`

6. Update your Stripe webhook settings in the Stripe Dashboard to point to the new production webhook URL.

## Local Development

1. Clone the repository
2. Install dependencies: `npm install`
3. Create a `.env` file with the required variables (see above)
4. Start the development server: `npm run dev`

## Important Notes

- Make sure your Stripe webhook secret is correctly set in your environment variables
- Ensure Firebase credentials are properly configured
- For local testing of webhooks, use Stripe CLI or a service like ngrok

## Project Structure

- `netlify/functions/api.js` - The serverless function that handles all API endpoints
- `firebase-config.js` - Firebase configuration and initialization
- `server.js` - Express server (used for local development)
- `public/` - Static assets

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