import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';

let io: Server;

export const initSocket = (server: HttpServer) => {
    io = new Server(server, {
        cors: {
            origin: "http://localhost:5173",
            methods: ["GET", "POST"]
        }
    });

    io.on('connection', (socket) => {
        console.log('Admin connected:', socket.id);

        socket.on('disconnect', () => {
            console.log('Admin disconnected:', socket.id);
        });
    });
};

export const broadcastInventory = (productId: string, stock: number) => {
    if (io) {
        io.emit('inventory_update', { productId, stock });
    }
};
