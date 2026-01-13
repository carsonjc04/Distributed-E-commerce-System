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
    { duration: '30s', target: 50 },    // Ramp up to 50 users over 30s
    { duration: '60s', target: 200 },   // Ramp up to 200 users over 60s
    { duration: '60s', target: 500 },   // Ramp up to 500 users over 60s
    { duration: '30s', target: 500 },   // Stay at 500 users for 30s
    { duration: '20s', target: 0 },     // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'], // More lenient thresholds for local
    http_req_failed: ['rate<0.10'], // Error rate < 10% (more lenient for connection issues)
    purchase_success: ['count>0'],
  },
  noConnectionReuse: false, // Reuse connections
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const PRODUCT_ID = __ENV.PRODUCT_ID || 'item-123';

export function setup() {
  console.log(`Initializing inventory for ${PRODUCT_ID}...`);
  
  const initPayload = JSON.stringify({
    productId: PRODUCT_ID,
    count: 1000, // Enough for testing up to 500 users
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
    'response time < 1000ms': (r) => r.timings.duration < 1000,
    'has response body': (r) => r.body && r.body.length > 0,
  });

  // Track specific outcomes (only if request succeeded)
  if (res.status === 200) {
    purchaseSuccess.add(1);
  } else if (res.status === 409) {
    purchaseSoldOut.add(1);
  } else {
    // Any other status or failed request counts as error
    purchaseErrors.add(1);
  }

  // Longer sleep (2 seconds) to reduce load on local system and prevent overwhelming server
  sleep(2.0);
}

export function teardown(data) {
  // Verify final inventory state
  console.log('\n=== Load Test Complete ===');
  console.log('Checking final inventory state...');
  
  const stockRes = http.get(`${BASE_URL}/api/product/${PRODUCT_ID}/stock`);
  
  if (stockRes.status === 200) {
    const stockData = JSON.parse(stockRes.body);
    console.log(`Final stock: ${stockData.stock}`);
    console.log(`Expected: ~1000 (2000 initial - ~1000 successful purchases)`);
  }
}

