import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom metrics
const purchaseSuccess = new Counter('purchase_success');
const purchaseSoldOut = new Counter('purchase_sold_out');
const purchaseErrors = new Counter('purchase_errors');
const purchaseLatency = new Trend('purchase_latency');

export const options = {
  stages: [
    { duration: '60s', target: 500 },    // Ramp up to 500 users over 60s
    { duration: '120s', target: 2000 },  // Ramp up to 2000 users over 2min
    { duration: '120s', target: 5000 },  // Ramp up to 5000 users over 2min
    { duration: '180s', target: 10000 }, // Ramp up to 10000 users over 3min (gradual)
    { duration: '120s', target: 10000 }, // Stay at 10000 users for 2min
    { duration: '60s', target: 0 },     // Ramp down to 0 over 1min
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'], // More lenient for very high load
    http_req_failed: ['rate<0.10'], // Error rate < 10% (more lenient for local testing)
    purchase_success: ['count>0'],
  },
  noConnectionReuse: false, // Reuse connections for better performance
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const PRODUCT_ID = __ENV.PRODUCT_ID || 'item-123';

export function setup() {
  // Initialize inventory before test starts
  console.log(`Initializing inventory for ${PRODUCT_ID}...`);
  
  const initPayload = JSON.stringify({
    productId: PRODUCT_ID,
    count: 15000, // More than we'll test to ensure we don't run out
  });

  const initRes = http.post(
    `${BASE_URL}/api/admin/inventory`,
    initPayload,
    { headers: { 'Content-Type': 'application/json' } }
  );

  if (initRes.status !== 200) {
    console.error(`Failed to initialize inventory: ${initRes.status}`);
    return { success: false };
  }

  console.log(`Inventory initialized successfully`);
  return { success: true };
}

export default function () {
  // Generate unique user ID and idempotency key
  const userId = `user-${__VU}-${__ITER}-${Date.now()}`;
  const idempotencyKey = `key-${__VU}-${__ITER}-${Date.now()}`;

  const payload = JSON.stringify({
    userId: userId,
    productId: PRODUCT_ID,
    idempotencyKey: idempotencyKey,
  });

  const params = {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'PurchaseRequest' },
  };

  const startTime = Date.now();
  const res = http.post(`${BASE_URL}/api/hold`, payload, params);
  const latency = Date.now() - startTime;

  // Record latency
  purchaseLatency.add(latency);

  // Validate response (handle failed requests gracefully)
  const success = check(res, {
    'status is 200 or 409': (r) => r.status === 200 || r.status === 409,
    'response time < 500ms': (r) => r.timings.duration < 500,
    'has response body': (r) => r.body && r.body.length > 0,
  });

  // Track specific outcomes
  if (res.status === 200) {
    purchaseSuccess.add(1);
  } else if (res.status === 409) {
    purchaseSoldOut.add(1);
  } else {
    purchaseErrors.add(1);
  }

  // Sleep to avoid hammering the server (longer sleep for high concurrency)
  sleep(1.0);
}

export function teardown(data) {
  // Verify final inventory state
  console.log('\n=== Load Test Complete ===');
  console.log('Checking final inventory state...');
  
  const stockRes = http.get(`${BASE_URL}/api/product/${PRODUCT_ID}/stock`);
  
  if (stockRes.status === 200) {
    const stockData = JSON.parse(stockRes.body);
    console.log(`Final stock: ${stockData.stock}`);
    console.log(`Expected: ~5000 (15000 initial - ~10000 successful purchases)`);
  }
}



