#!/bin/bash

# Incremental Load Test Runner
# Tests the system at increasing concurrency levels: 500 → 1k → 2k → 5k → 10k

set -e

BASE_URL="${BASE_URL:-http://localhost:3000}"
PRODUCT_ID="${PRODUCT_ID:-item-123}"

echo "🚀 Incremental Load Test Runner"
echo "================================"
echo ""
echo "This will test your system at increasing concurrency levels"
echo "to find the maximum it can handle."
echo ""

# Check if k6 is installed
if ! command -v k6 &> /dev/null; then
    echo "❌ k6 is not installed!"
    echo "Install: brew install k6"
    exit 1
fi

# Check if server is running
echo "🔍 Checking if server is running..."
if ! curl -s "$BASE_URL/health" > /dev/null; then
    echo "❌ Server is not running at $BASE_URL"
    exit 1
fi
echo "✅ Server is running"
echo ""

# Test levels
declare -a TEST_LEVELS=(500 1000 2000 5000 10000)
declare -a INVENTORY_LEVELS=(1000 2000 4000 10000 15000)

for i in "${!TEST_LEVELS[@]}"; do
    USERS=${TEST_LEVELS[$i]}
    INVENTORY=${INVENTORY_LEVELS[$i]}
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🧪 Testing with $USERS concurrent users"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    # Initialize inventory
    echo "📦 Initializing inventory to $INVENTORY..."
    curl -s -X POST "$BASE_URL/api/admin/inventory" \
        -H "Content-Type: application/json" \
        -d "{\"productId\": \"$PRODUCT_ID\", \"count\": $INVENTORY}" > /dev/null
    echo "✅ Inventory set to $INVENTORY"
    echo ""
    
    # Create temporary k6 script for this test level
    cat > /tmp/load-test-${USERS}.js << EOF
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

const purchaseSuccess = new Counter('purchase_success');
const purchaseErrors = new Counter('purchase_errors');

export const options = {
  stages: [
    { duration: '30s', target: ${USERS} },
    { duration: '60s', target: ${USERS} },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.10'],
    purchase_success: ['count>0'],
  },
};

const BASE_URL = '${BASE_URL}';
const PRODUCT_ID = '${PRODUCT_ID}';

export default function () {
  const userId = \`user-\${__VU}-\${__ITER}-\${Date.now()}\`;
  const idempotencyKey = \`key-\${__VU}-\${__ITER}-\${Date.now()}\`;

  const payload = JSON.stringify({
    userId: userId,
    productId: PRODUCT_ID,
    idempotencyKey: idempotencyKey,
  });

  const res = http.post(\`\${BASE_URL}/api/hold\`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });

  check(res, {
    'status is 200 or 409': (r) => r.status === 200 || r.status === 409,
    'has response body': (r) => r.body && r.body.length > 0,
  });

  if (res.status === 200) {
    purchaseSuccess.add(1);
  } else {
    purchaseErrors.add(1);
  }

  sleep(1.0);
}
EOF
    
    echo "⏱️  Running test (this may take a few minutes)..."
    echo ""
    
    # Run the test
    if k6 run /tmp/load-test-${USERS}.js 2>&1 | tee /tmp/test-${USERS}.log; then
        echo ""
        echo "✅ Test with $USERS users completed successfully"
        
        # Check final stock
        FINAL_STOCK=$(curl -s "$BASE_URL/api/product/$PRODUCT_ID/stock" | grep -o '"stock":[0-9]*' | cut -d':' -f2)
        echo "📊 Final stock: $FINAL_STOCK"
        echo ""
        
        # Ask if user wants to continue
        if [ $i -lt $((${#TEST_LEVELS[@]} - 1)) ]; then
            read -p "Continue to next level (${TEST_LEVELS[$((i+1))]} users)? [y/N]: " CONTINUE
            if [[ ! "$CONTINUE" =~ ^[Yy]$ ]]; then
                echo "Stopping tests."
                break
            fi
            echo ""
        fi
    else
        echo ""
        echo "❌ Test with $USERS users failed or had too many errors"
        echo "   Your system's limit appears to be around ${TEST_LEVELS[$((i-1))]} users"
        break
    fi
    
    # Clean up
    rm -f /tmp/load-test-${USERS}.js
    echo ""
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Incremental testing complete!"
echo ""
echo "📊 Test logs saved in /tmp/test-*.log"
echo ""

