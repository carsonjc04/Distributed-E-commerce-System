// stress-test.js
const productId = "item-123";
const endpoint = "http://localhost:3000/api/hold"; // Check your port

// 1. Reset Inventory to 1 (You might need a helper route or do this manually in Redis)
console.log("Starting Stress Test: 100 users fighting for 100 items...");

const attack = async () => {
    // Reset inventory first
    await fetch("http://localhost:3000/api/admin/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, count: 100 }),
    });
    console.log("Inventory reset to 100.");

    const requests = Array.from({ length: 100 }).map((_, i) => {
        return fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: `user-${i}`, productId, idempotencyKey: `key-${i}` }),
        }).then((res) => ({ status: res.status, user: `user-${i}` }))
            .catch((err) => ({ status: 'ERROR', error: err.message }));
    });

    const results = await Promise.all(requests);

    const successes = results.filter((r) => r.status === 200);
    const failures = results.filter((r) => r.status === 409);

    const errors = results.filter((r) => r.status === 'ERROR');

    console.log(`\nResults:`);
    console.log(`✅ Successful Buys: ${successes.length} (Should be 100)`);
    console.log(`❌ Sold Out responses: ${failures.length} (Should be 0)`);
    console.log(`⚠️ Errors: ${errors.length}`);
    if (errors.length > 0) console.log(errors[0]);

    const others = results.filter(r => r.status !== 200 && r.status !== 409 && r.status !== 'ERROR');
    if (others.length > 0) {
        console.log(`❓ Other Statuses: ${others.length}`);
        console.log(others[0]);
    }
};

attack();
