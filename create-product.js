require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

/**
 * This script creates a product and price in Stripe
 * Run it with: node create-product.js
 */
async function createProduct() {
  try {
    // Create a product
    const product = await stripe.products.create({
      name: 'Premium Plan',
      description: 'Access to all premium features',
    });
    
    // Create a price for the product
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: 1999, // $19.99 in cents
      currency: 'usd',
      recurring: {
        interval: 'month',
      },
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

createProduct(); 