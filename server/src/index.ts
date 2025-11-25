import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { initSocket, broadcastInventory } from './services/socket.service';
import { attemptReserveStock, initializeInventory, checkIdempotency, saveIdempotency } from './services/redis.service';
import { sendMessage } from './services/sqs.service';
import redis from './services/redis.service'; // Import redis instance to fetch stock

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Create HTTP server
const httpServer = createServer(app);

// Initialize Socket.IO
initSocket(httpServer);

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'velocity-backend' });
});

app.post('/api/hold', async (req, res) => {
    const { userId, productId, idempotencyKey } = req.body;

    if (!userId || !productId || !idempotencyKey) {
        return res.status(400).json({ error: 'Missing userId, productId, or idempotencyKey' });
    }

    try {
        // 1. Check Idempotency
        const cachedResult = await checkIdempotency(idempotencyKey);
        if (cachedResult) {
            res.set('x-idempotency-hit', 'true');
            return res.status(cachedResult.status).json(cachedResult.body);
        }

        // 2. Attempt Reserve
        const success = await attemptReserveStock(userId, productId);

        if (success) {
            // Offload to SQS
            await sendMessage({ userId, productId });

            const responseBody = { message: 'Reserved' };
            await saveIdempotency(idempotencyKey, { status: 200, body: responseBody });

            // Broadcast new stock to admins
            // We need to fetch the current stock to be accurate
            const currentStock = await redis.get(`inventory:${productId}`);
            if (currentStock) {
                broadcastInventory(productId, parseInt(currentStock));
            }

            return res.status(200).json(responseBody);
        } else {
            const responseBody = { error: 'Sold Out' };
            await saveIdempotency(idempotencyKey, { status: 409, body: responseBody });

            return res.status(409).json(responseBody);
        }
    } catch (error) {
        console.error('Hold error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Restock endpoint for Ops
app.post('/api/restock', async (req, res) => {
    const { productId, amount } = req.body;

    // Update Redis
    await initializeInventory(productId, amount);

    // Broadcast update
    broadcastInventory(productId, amount);

    res.json({ message: `Restocked ${productId} to ${amount}` });
});

// Temporary helper to set initial stock for testing
app.post('/api/admin/inventory', async (req, res) => {
    const { productId, count } = req.body;
    await initializeInventory(productId, count);

    // Broadcast update
    broadcastInventory(productId, count);

    res.json({ message: `Set inventory for ${productId} to ${count}` });
});

httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
