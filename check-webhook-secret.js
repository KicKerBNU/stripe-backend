require('dotenv').config();

const isDev = process.env.NODE_ENV !== 'production';
const webhookSecret = isDev 
  ? process.env.STRIPE_WEBHOOK_SECRET_DEV 
  : process.env.STRIPE_WEBHOOK_SECRET_PROD;



