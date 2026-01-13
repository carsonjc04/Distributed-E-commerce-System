import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';
import { metricsService } from './metrics.service';

let io: Server;

export const initSocket = (server: HttpServer) => {
    io = new Server(server, {
        cors: {
            origin: "http://localhost:5173",
            methods: ["GET", "POST"]
        }
    });

    io.on('connection', (socket) => {
        // Admin connected via WebSocket

        socket.on('disconnect', () => {
            // Admin disconnected
        });
    });

    // Broadcast metrics every 2 seconds
    setInterval(() => {
        broadcastMetrics();
    }, 2000);
};

export const broadcastInventory = (productId: string, stock: number) => {
    if (io) {
        io.emit('inventory_update', { productId, stock });
    }
};

export const broadcastMetrics = () => {
    if (io) {
        const metrics = {
            latency: metricsService.getLatencyPercentiles(),
            throughput: metricsService.getThroughput(),
            orders: metricsService.getOrderStats(),
            health: metricsService.getSystemHealth(),
            timeSeries: metricsService.getTimeSeriesData(),
        };
        io.emit('metrics_update', metrics);
    }
};
