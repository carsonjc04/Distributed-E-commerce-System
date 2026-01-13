#!/bin/bash

# Velocity Load Test Runner
# Automates inventory initialization and k6 load test execution

set -e

BASE_URL="${BASE_URL:-http://localhost:3000}"
PRODUCT_ID="${PRODUCT_ID:-item-123}"
# Default inventory based on test type (will be adjusted if light test)
INVENTORY_COUNT="${INVENTORY_COUNT:-2000}"

echo "🚀 Velocity Load Test Runner"
echo "============================"
echo ""
echo "Configuration:"
echo "  Base URL: $BASE_URL"
echo "  Product ID: $PRODUCT_ID"
echo ""

# Check if k6 is installed
if ! command -v k6 &> /dev/null; then
    echo "❌ k6 is not installed!"
    echo ""
    echo "Install k6:"
    echo "  macOS:   brew install k6"
    echo "  Linux:   See https://k6.io/docs/getting-started/installation/"
    exit 1
fi

# Check if server is running
echo "🔍 Checking if server is running..."
if ! curl -s "$BASE_URL/health" > /dev/null; then
    echo "❌ Server is not running at $BASE_URL"
    echo "   Please start the server first: cd server && npm run dev"
    exit 1
fi
echo "✅ Server is running"
echo ""

# Ask user which test to run
echo "🧪 Select load test:"
echo "  1) Light test (up to 1,000 users) - Recommended for local"
echo "  2) Full test (up to 10,000 users) - For production-scale"
read -p "Enter choice [1]: " TEST_CHOICE
TEST_CHOICE=${TEST_CHOICE:-1}

if [ "$TEST_CHOICE" = "2" ]; then
    TEST_FILE="load-test.js"
    INVENTORY_COUNT=15000
    echo "   Running FULL test (10,000+ concurrent requests)"
else
    TEST_FILE="load-test-light.js"
    INVENTORY_COUNT=2000
    echo "   Running LIGHT test (1,000 concurrent requests)"
fi

# Update inventory initialization
echo "📦 Initializing inventory to $INVENTORY_COUNT..."
INIT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/admin/inventory" \
    -H "Content-Type: application/json" \
    -d "{\"productId\": \"$PRODUCT_ID\", \"count\": $INVENTORY_COUNT}")

if echo "$INIT_RESPONSE" | grep -q "message"; then
    echo "✅ Inventory initialized to $INVENTORY_COUNT"
else
    echo "⚠️  Warning: Inventory initialization may have failed"
    echo "   Response: $INIT_RESPONSE"
fi

# Get initial stock after initialization
INITIAL_STOCK=$(curl -s "$BASE_URL/api/product/$PRODUCT_ID/stock" | grep -o '"stock":[0-9]*' | cut -d':' -f2)
echo "📊 Initial stock: $INITIAL_STOCK"
echo ""

echo "   Press Ctrl+C to stop early"
echo ""

k6 run \
    --env BASE_URL="$BASE_URL" \
    --env PRODUCT_ID="$PRODUCT_ID" \
    "$TEST_FILE"

echo ""
echo "📊 Checking final inventory state..."

FINAL_STOCK=$(curl -s "$BASE_URL/api/product/$PRODUCT_ID/stock" | grep -o '"stock":[0-9]*' | cut -d':' -f2)
SUCCESSFUL_PURCHASES=$((INITIAL_STOCK - FINAL_STOCK))

echo ""
echo "============================"
echo "📈 Test Summary:"
echo "  Initial Stock: $INITIAL_STOCK"
echo "  Final Stock: $FINAL_STOCK"
echo "  Successful Purchases: ~$SUCCESSFUL_PURCHASES"
echo ""
echo "✅ Load test complete!"



