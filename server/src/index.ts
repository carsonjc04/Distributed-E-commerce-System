import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { initSocket, broadcastInventory, broadcastMetrics } from './services/socket.service';
import { attemptReserveStock, initializeInventory, checkIdempotency, saveIdempotency } from './services/redis.service';
import { sendMessage } from './services/sqs.service';
import { metricsService } from './services/metrics.service';
import { metricsMiddleware } from './middleware/metrics.middleware';
import redis from './services/redis.service'; // Import redis instance to fetch stock

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(metricsMiddleware);

const httpServer = createServer(app);

initSocket(httpServer);

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'velocity-backend' });
});

// Get current stock for a product
app.get('/api/product/:productId/stock', async (req, res) => {
    const { productId } = req.params;
    try {
        const stock = await redis.get(`inventory:${productId}`);
        const stockCount = stock ? parseInt(stock) : 0;
        res.json({ productId, stock: stockCount });
    } catch (error) {
        console.error('Error fetching stock:', error);
        res.status(500).json({ error: 'Failed to fetch stock' });
    }
});

app.post('/api/hold', async (req, res) => {
    const { userId, productId, idempotencyKey } = req.body;

    if (!userId || !productId || !idempotencyKey) {
        return res.status(400).json({ error: 'Missing userId, productId, or idempotencyKey' });
    }

    try {
        const cachedResult = await checkIdempotency(idempotencyKey);
        if (cachedResult) {
            res.set('x-idempotency-hit', 'true');
            return res.status(cachedResult.status).json(cachedResult.body);
        }

        const success = await attemptReserveStock(userId, productId);

        if (success) {
            // Offload to SQS
            await sendMessage({ userId, productId });

            const responseBody = { message: 'Reserved' };
            await saveIdempotency(idempotencyKey, { status: 200, body: responseBody });

            // Record successful order
            metricsService.recordOrder(true);

            // Broadcast new stock to admins
            const currentStock = await redis.get(`inventory:${productId}`);
            if (currentStock) {
                broadcastInventory(productId, parseInt(currentStock));
            }

            // Broadcast metrics update
            broadcastMetrics();

            return res.status(200).json(responseBody);
        } else {
            const responseBody = { error: 'Sold Out' };
            await saveIdempotency(idempotencyKey, { status: 409, body: responseBody });

            // Record failed order
            metricsService.recordOrder(false);

            // Broadcast metrics update
            broadcastMetrics();

            return res.status(409).json(responseBody);
        }
    } catch (error) {
        console.error('Hold error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/api/restock', async (req, res) => {
    const { productId, amount } = req.body;

    // Update Redis
    await initializeInventory(productId, amount);

    // Broadcast update
    broadcastInventory(productId, amount);

    res.json({ message: `Restocked ${productId} to ${amount}` });
});

app.post('/api/admin/inventory', async (req, res) => {
    const { productId, count } = req.body;
    await initializeInventory(productId, count);

    // Broadcast update
    broadcastInventory(productId, count);

    res.json({ message: `Set inventory for ${productId} to ${count}` });
});

app.get('/api/metrics', (req, res) => {
    const metrics = {
        latency: metricsService.getLatencyPercentiles(),
        throughput: metricsService.getThroughput(),
        orders: metricsService.getOrderStats(),
        health: metricsService.getSystemHealth(),
        timeSeries: metricsService.getTimeSeriesData(),
    };
    res.json(metrics);
});

app.post('/api/metrics/reset', (req, res) => {
    metricsService.reset();
    broadcastMetrics();
    res.json({ message: 'Metrics reset' });
});

// Initialize default inventory on server start
const initializeDefaultInventory = async () => {
    const defaultProductId = 'item-123';
    const existingStock = await redis.get(`inventory:${defaultProductId}`);
    
    if (!existingStock) {
        await initializeInventory(defaultProductId, 100);
        console.log(`✅ Initialized inventory for ${defaultProductId} to 100`);
        broadcastInventory(defaultProductId, 100);
    } else {
        const stock = parseInt(existingStock);
        console.log(`📦 Current inventory for ${defaultProductId}: ${stock}`);
        broadcastInventory(defaultProductId, stock);
    }
};

httpServer.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    await initializeDefaultInventory();
});
