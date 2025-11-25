// idempotency-test.js
// Using native fetch (Node 18+)

const productId = "item-idempotency";
const endpoint = "http://localhost:3000/api/hold";

const runTest = async () => {
    // 1. Reset Inventory
    await fetch("http://localhost:3000/api/admin/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, count: 1 }),
    });
    console.log("Inventory reset to 1.");

    const idempotencyKey = "key-123";
    const userId = "user-test";

    // 2. First Request
    console.log("\n--- Request 1 (Fresh) ---");
    const res1 = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, productId, idempotencyKey }),
    });
    const data1 = await res1.json();
    console.log(`Status: ${res1.status}`);
    console.log(`Body:`, data1);
    console.log(`X-Idempotency-Hit: ${res1.headers.get('x-idempotency-hit')}`);

    // 3. Second Request (Duplicate)
    console.log("\n--- Request 2 (Duplicate) ---");
    const res2 = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, productId, idempotencyKey }),
    });
    const data2 = await res2.json();
    console.log(`Status: ${res2.status}`);
    console.log(`Body:`, data2);
    console.log(`X-Idempotency-Hit: ${res2.headers.get('x-idempotency-hit')}`);

    if (res2.status === 200 && res2.headers.get('x-idempotency-hit') === 'true') {
        console.log("\n✅ SUCCESS: Idempotency worked!");
    } else {
        console.log("\n❌ FAILURE: Idempotency did not work as expected.");
    }

    // 4. Third Request (Different Key, should fail if stock is gone)
    console.log("\n--- Request 3 (New Key) ---");
    const res3 = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "user-other", productId, idempotencyKey: "key-456" }),
    });
    console.log(`Status: ${res3.status} (Expected 409)`);
};

runTest();
