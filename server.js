require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { db, admin } = require('./firebase-config');

// Determine environment
const isProduction = process.env.NODE_ENV === 'production';


// Use appropriate API keys based on environment
const stripeSecretKey = isProduction 
  ? process.env.STRIPE_SECRET_KEY_PROD 
  : process.env.STRIPE_SECRET_KEY_DEV;

const stripeWebhookSecret = isProduction
  ? process.env.STRIPE_WEBHOOK_SECRET_PROD
  : process.env.STRIPE_WEBHOOK_SECRET_DEV;



// Initialize Stripe with the correct key
const stripe = require('stripe')(stripeSecretKey);

const app = express();
const PORT = process.env.PORT || 3000;

// Firebase utility functions
async function getCompanyIdFromEmail(email) {
  if (!email) {
    return null;
  }

  // Check if Firebase is initialized
  if (!db) {
    return null;
  }

  try {
    // Query the users collection where email matches
    const usersSnapshot = await db.collection('users')
      .where('email', '==', email)
      .limit(1)
      .get();
    
    if (usersSnapshot.empty) {
      return null;
    }
    
    // Get the first user document (there should only be one)
    const userData = usersSnapshot.docs[0].data();
    
    if (!userData.companyId) {
      return null;
    }
    return userData.companyId;
  } catch (error) {
    console.error('Error getting companyId from email:', error);
    return null;
  }
}

async function updateSubscriptionForCompany(companyId, subscriptionData) {
  if (!companyId) {
    return false;
  }

  // Check if Firebase is initialized
  if (!db) {
    return false;
  }

  try {
    // Reference to the subscription document
    const subscriptionRef = db.collection('subscriptions').doc(companyId);
    
    // Check if subscription document exists
    const subscriptionDoc = await subscriptionRef.get();
    
    let updateData = {
      ...subscriptionData,
      updatedAt: new Date().toISOString()
    };
    
    if (subscriptionDoc.exists) {
      // Update existing subscription
      await subscriptionRef.update(updateData);
        
    } else {
      // Create new subscription document
      updateData.createdAt = new Date().toISOString();
      updateData.companyId = companyId;
      
      // Using set with merge option allows creation if not exists
      await subscriptionRef.set(updateData, { merge: true });
      
    }
    
    return true;
  } catch (error) {
    console.error('Error updating subscription for company:', error);
    return false;
  }
}

// Calculate subscription end date based on plan type
function calculateExpirationDate(planType) {
  const now = new Date();
  
  switch (planType.toLowerCase()) {
    case 'anual':
    case 'annual':
      now.setFullYear(now.getFullYear() + 1);
      break;
    case 'trimestral':
    case 'quarterly':
      now.setMonth(now.getMonth() + 3);
      break;
    case 'mensal':
    case 'monthly':
      now.setMonth(now.getMonth() + 1);
      break;
    default:
      // Default to 1 month if plan type is unknown
      now.setMonth(now.getMonth() + 1);
  }
  
  return now.toISOString();
}

// IMPORTANT: Configure middleware for all routes EXCEPT the webhook
// Use JSON parsing for all routes except /webhook
app.use((req, res, next) => {
  if (req.originalUrl === '/webhook') {
    next();
  } else {
    bodyParser.json()(req, res, next);
  }
});

// Enable CORS for all routes
app.use(cors());

// Webhook route with explicit raw body handling
app.post('/webhook', bodyParser.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  
  
  let event;
  
  try {
    
    
    
    if (stripeWebhookSecret && sig) {
      
      // Verify webhook signature
      event = stripe.webhooks.constructEvent(req.body, sig, stripeWebhookSecret);
      
    } else {
      if (Buffer.isBuffer(req.body)) {
        event = JSON.parse(req.body.toString());
      } else {
        event = req.body;
      }
    }
    
    // Get customer email
    let customerEmail = null;
    let planType = null;
    
    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        
        // Email is directly available in checkout session
        if (session.customer_details && session.customer_details.email) {
          customerEmail = session.customer_details.email;
          
          
          // Try to determine the plan type from metadata or line items
          if (session.metadata && session.metadata.planType) {
            planType = session.metadata.planType;
          } else {
            // Get the line items to determine plan
            try {
              const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
              if (lineItems.data.length > 0) {
                // Get the product details to determine plan type
                const productId = lineItems.data[0].price.product;
                    
                if (productId === process.env.STRIPE_PRODUCT_ID_ANUAL) {
                  planType = 'annual';
                } else if (productId === process.env.STRIPE_PRODUCT_ID_TRIMESTRAL) {
                  planType = 'quarterly';
                } else if (productId === process.env.STRIPE_PRODUCT_ID_MENSAL) {
                  planType = 'monthly';
                }
              }
            } catch (err) {
              console.error('Error getting line items:', err);
            }
          }
          
          if (planType) {
            
            // Get company ID from user email
            const companyId = await getCompanyIdFromEmail(customerEmail);
            
            if (companyId) {
              // Calculate expiration date based on plan type
              const expirationDate = calculateExpirationDate(planType);
              
              // Update subscription in Firebase
              await updateSubscriptionForCompany(companyId, {
                isSubscribed: true,
                expirationDate,
                plan: planType,
                stripeSessionId: session.id,
                stripeCustomerId: session.customer
              });
              
              
            } 
          }
        }
        break;
        
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        const subscription = event.data.object;
        
        // Get customer email from subscription
        if (subscription.customer) {
          try {
            const customer = await stripe.customers.retrieve(subscription.customer);
            customerEmail = customer.email;
            
            // Determine plan type from product ID
            if (subscription.plan && subscription.plan.product) {
              const productId = subscription.plan.product;
              
              if (productId === process.env.STRIPE_PRODUCT_ID_ANUAL) {
                planType = 'annual';
              } else if (productId === process.env.STRIPE_PRODUCT_ID_TRIMESTRAL) {
                planType = 'quarterly';
              } else if (productId === process.env.STRIPE_PRODUCT_ID_MENSAL) {
                planType = 'monthly';
              }
              
              if (planType) {
                
                // Get company ID from user email
                const companyId = await getCompanyIdFromEmail(customerEmail);
                
                if (companyId) {
                  // Calculate expiration date from current period end
                  const expirationDate = new Date(subscription.current_period_end * 1000).toISOString();
                  
                  // Update subscription in Firebase
                  await updateSubscriptionForCompany(companyId, {
                    isSubscribed: subscription.status === 'active',
                    expirationDate,
                    plan: planType,
                    stripeSubscriptionId: subscription.id,
                    stripeCustomerId: subscription.customer
                  });
                  
                  
                  
                }
              }
            }
          } catch (err) {
            console.error('Error retrieving customer:', err.message);
          }
        }
        break;
        
      case 'invoice.payment_succeeded':
        const invoice = event.data.object;
        if (invoice.subscription && invoice.customer) {
          try {
            const customer = await stripe.customers.retrieve(invoice.customer);
            customerEmail = customer.email;
            
            // Get subscription details to determine plan type and expiration
            const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
            
            if (subscription.plan && subscription.plan.product) {
              const productId = subscription.plan.product;
              
              if (productId === process.env.STRIPE_PRODUCT_ID_ANUAL) {
                planType = 'annual';
              } else if (productId === process.env.STRIPE_PRODUCT_ID_TRIMESTRAL) {
                planType = 'quarterly';
              } else if (productId === process.env.STRIPE_PRODUCT_ID_MENSAL) {
                planType = 'monthly';
              }
              
              if (planType) {
                
                // Get company ID from user email
                const companyId = await getCompanyIdFromEmail(customerEmail);
                
                if (companyId) {
                  // Calculate expiration date from current period end
                  const expirationDate = new Date(subscription.current_period_end * 1000).toISOString();
                  
                  // Update subscription in Firebase
                  await updateSubscriptionForCompany(companyId, {
                    isSubscribed: true,
                    expirationDate,
                    plan: planType,
                    stripeSubscriptionId: subscription.id,
                    stripeCustomerId: invoice.customer,
                    lastPaymentDate: new Date().toISOString(),
                    lastInvoiceId: invoice.id
                  });
                  
                  
                } 
              } 
            }
          } catch (err) {
            console.error('Error processing invoice:', err.message);
          }
        }
        break;
    }
    
    // Return a 200 response to acknowledge receipt of the event
    res.json({received: true});
  } catch (err) {
    console.error(`Webhook Error: ${err.message}`);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }
});

// Routes
app.get('/', (req, res) => {
  res.send(`Stripe Payment Server is running in ${isProduction ? 'production' : 'development'} mode`);
});

// Diagnostic endpoint to verify Stripe configuration
app.get('/api/config/check', (req, res) => {
  const config = {
    environment: isProduction ? 'production' : 'development',
    stripeConfigured: !!stripeSecretKey,
    webhookSecretConfigured: !!stripeWebhookSecret,
    firebaseConfigured: !!db,
    productIdsConfigured: {
      annual: !!process.env.STRIPE_PRODUCT_ID_ANUAL,
      quarterly: !!process.env.STRIPE_PRODUCT_ID_TRIMESTRAL, 
      monthly: !!process.env.STRIPE_PRODUCT_ID_MENSAL
    }
  };
  
  res.json(config);
});

// Other routes
app.post('/create-payment-intent', async (req, res) => {
  try {
    const { amount, currency = 'usd', description } = req.body;
    
    // Validate input
    if (!amount) {
      return res.status(400).json({ error: 'Amount is required' });
    }
    
    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Stripe expects amount in cents
      currency,
      description,
      automatic_payment_methods: {
        enabled: true,
      },
    });
    
    res.json({ 
      clientSecret: paymentIntent.client_secret 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/create-checkout-session', async (req, res) => {
  try {
    const { 
      priceId,
      successUrl = 'https://your-website.com/success',
      cancelUrl = 'https://your-website.com/cancel' 
    } = req.body;
    
    // Validate input
    if (!priceId) {
      return res.status(400).json({ error: 'Price ID is required' });
    }
    
    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
    });
    
    res.json({ url: session.url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/create-subscription', async (req, res) => {
  try {
    const { 
      planType,
      successUrl = 'https://your-website.com/success', 
      cancelUrl = 'https://your-website.com/cancel',
      customerEmail
    } = req.body;
    
    // Validate input
    if (!planType) {
      return res.status(400).json({ error: 'Plan type is required' });
    }
    
    // Map plan type to product ID
    let productId;
    switch (planType.toLowerCase()) {
      case 'anual':
      case 'annual':
        productId = process.env.STRIPE_PRODUCT_ID_ANUAL;
        break;
      case 'trimestral':
      case 'quarterly':
        productId = process.env.STRIPE_PRODUCT_ID_TRIMESTRAL;
        break;
      case 'mensal':
      case 'monthly':
        productId = process.env.STRIPE_PRODUCT_ID_MENSAL;
        break;
      default:
        return res.status(400).json({ error: 'Invalid plan type' });
    }
    
    // Get all prices for this product to find the right one
    const prices = await stripe.prices.list({
      product: productId,
      active: true,
    });
    
    if (prices.data.length === 0) {
      return res.status(404).json({ error: 'No price found for this product' });
    }
    
    // Create subscription checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: prices.data[0].id, // Use the first active price
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: customerEmail, // Pre-fill customer email if provided
    });
    
    res.json({ url: session.url });
  } catch (error) {
    console.error('Subscription error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} in ${isProduction ? 'production' : 'development'} mode`);
  console.log(`Webhook endpoint available at http://localhost:${PORT}/webhook`);
});

