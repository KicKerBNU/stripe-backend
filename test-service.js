#!/usr/bin/env node
/**
 * Test script to verify the Stripe payment service is running and working correctly.
 * Run with: node test-service.js [baseUrl]
 * 
 * Examples:
 *   node test-service.js                    # Uses http://localhost:3000
 *   node test-service.js https://your-site.netlify.app/api  # Tests production
 */

require('dotenv').config();

const baseUrl = process.argv[2] || 'http://localhost:3000';

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`✅ ${name}`);
    return true;
  } catch (err) {
    console.error(`❌ ${name}`);
    console.error(`   Error: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('\n🔍 Stripe Payment Service - Health Check\n');
  console.log(`Testing: ${baseUrl}\n`);

  let passed = 0;
  let total = 0;

  // Test 1: Server is reachable
  total++;
  const reachable = await runTest('Server is reachable', async () => {
    const res = await fetch(`${baseUrl}/`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  });
  if (reachable) passed++;

  // Test 2: Config check endpoint
  total++;
  const configOk = await runTest('Config check endpoint', async () => {
    const res = await fetch(`${baseUrl}/api/config/check`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    
    const config = await res.json();
    
    if (!config.stripeConfigured) throw new Error('Stripe not configured');
    if (!config.webhookSecretConfigured) throw new Error('Webhook secret not configured');
    if (!config.firebaseConfigured) console.log('   ⚠️  Firebase not configured (optional for some flows)');
    
    const products = config.productIdsConfigured;
    if (!products.annual || !products.quarterly || !products.monthly) {
      throw new Error('Product IDs missing: ' + 
        [!products.annual && 'annual', !products.quarterly && 'quarterly', !products.monthly && 'monthly'].filter(Boolean).join(', '));
    }
    
    console.log(`   Environment: ${config.environment}`);
  });
  if (configOk) passed++;

  // Test 3: Create subscription checkout (validates Stripe API + products/prices)
  total++;
  const subOk = await runTest('Create subscription checkout session', async () => {
    const res = await fetch(`${baseUrl}/create-subscription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planType: 'monthly',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }

    if (!data.url) throw new Error('No checkout URL returned');

    console.log(`   Checkout URL created: ${data.url.substring(0, 50)}...`);
  });
  if (subOk) passed++;

  // Test all 3 plan types (annual, quarterly, monthly)
  for (const plan of ['annual', 'quarterly']) {
    total++;
    const ok = await runTest(`Create checkout for ${plan} plan`, async () => {
      const res = await fetch(`${baseUrl}/create-subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planType: plan,
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      if (!data.url) throw new Error('No checkout URL returned');
    });
    if (ok) passed++;
  }

  // Summary
  console.log('\n' + '─'.repeat(50));
  console.log(`Result: ${passed}/${total} tests passed\n`);

  if (passed === total) {
    console.log('✅ Service is running and working correctly.');
    console.log('   Product IDs match your Stripe products, and prices are being fetched.\n');
  } else {
    console.log('⚠️  Some tests failed. Check the errors above.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
