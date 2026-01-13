import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

// Custom metrics
const purchaseSuccess = new Counter('purchase_success');
const purchaseSoldOut = new Counter('purchase_sold_out');
const purchaseErrors = new Counter('purchase_errors');

export const options = {
  stages: [
    { duration: '60s', target: 500 },   // Ramp up to 500 users over 60s
    { duration: '60s', target: 1000 },  // Ramp up to 1000 users over 60s
    { duration: '90s', target: 1000 },  // Stay at 1000 users for 90s
    { duration: '30s', target: 0 },    // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.10'], // Error rate < 10%
    purchase_success: ['count>0'],
  },
  noConnectionReuse: false,
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const PRODUCT_ID = __ENV.PRODUCT_ID || 'item-123';

export function setup() {
  console.log(`Initializing inventory for ${PRODUCT_ID}...`);
  
  const initPayload = JSON.stringify({
    productId: PRODUCT_ID,
    count: 2000, // Enough for 1000 users
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

  console.log(`Inventory initialized successfully to 2000`);
  return { success: true };
}

export default function () {
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

  const res = http.post(`${BASE_URL}/api/hold`, payload, params);

  // Validate response (handle failed requests gracefully)
  check(res, {
    'status is 200 or 409': (r) => r.status === 200 || r.status === 409,
    'response time < 2000ms': (r) => r.timings.duration < 2000,
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

  // Sleep to reduce load
  sleep(1.5);
}

export function teardown(data) {
  console.log('\n=== Load Test Complete ===');
  console.log('Checking final inventory state...');
  
  const stockRes = http.get(`${BASE_URL}/api/product/${PRODUCT_ID}/stock`);
  
  if (stockRes.status === 200) {
    const stockData = JSON.parse(stockRes.body);
    console.log(`Final stock: ${stockData.stock}`);
    console.log(`Expected: ~1000 (2000 initial - ~1000 successful purchases)`);
  }
}

