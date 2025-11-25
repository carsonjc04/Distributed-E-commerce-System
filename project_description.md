## Project Title: "Velocity" - High-Concurrency Flash Sale Engine
**Objective:** Build a fault-tolerant e-commerce backend capable of handling 10k+ concurrent requests for limited inventory without overselling.

### 1. Core Tech Stack
* **Frontend:** React 19, Redux Toolkit (RTK), Tailwind CSS.
* **Backend:** Node.js (Express or Fastify) or Go (Golang).
* **Database:** DynamoDB (Product Catalog/Orders), Redis (Inventory Hot-State).
* **Infrastructure:** AWS Lambda (Serverless Compute), AWS SQS (Traffic Buffering), AWS API Gateway.

### 2. Critical Engineering constraints (The "Amazon" Requirements)
* **Race Condition Handling:** You MUST use Redis Atomic Counters (INCR/DECR) or Lua Scripts to deduct inventory. Do NOT use "Read-then-Write" logic in the database, as this causes race conditions.
* **Queue-Based Load Leveling:** Incoming "Buy" requests must not hit the database directly. They must go: API Gateway -> SQS Queue -> Lambda Worker -> DB.
* **Optimistic UI:** The frontend must immediately reflect "Item Purchased" while the backend processes the queue. Handle rollback if the purchase fails.
* **Idempotency:** The "Buy" endpoint must accept an `idempotency_key` (UUID) so retrying a request doesn't purchase the item twice.

### 3. Key Features to Implement
1.  **Inventory Locking:** A "Hold" system where adding an item to the cart reserves it in Redis for 5 minutes (TTL).
2.  **The "Waiting Room":** If inventory count in Redis hits 0, new requests are rejected or queued before touching the main DB.
3.  **Admin Dashboard:** A real-time WebSocket view of inventory dropping as users buy items.

### 4. API Contract (Simplified)
* `POST /purchase`: Payload `{ userId, productId, idempotencyKey }`. Returns `202 Accepted` (if queued).
* `GET /product/:id/status`: Returns current stock and queue depth.