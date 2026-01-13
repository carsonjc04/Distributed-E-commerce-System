#!/bin/bash

# Velocity E-Commerce Project - Service Startup Script

echo "🚀 Starting Velocity E-Commerce Services..."
echo ""

# Step 1: Stop any existing processes
echo "📋 Stopping existing processes..."
kill -9 $(lsof -ti:3000,5173) 2>/dev/null || echo "   No processes to stop"
echo ""

# Step 2: Start Docker services
echo "🐳 Starting Docker services (Redis & LocalStack)..."
cd "$(dirname "$0")"
docker-compose up -d
sleep 2
echo "   ✅ Docker services started"
echo ""

# Step 3: Start Backend Server
echo "🖥️  Starting backend server (port 3000)..."
cd server
npm run dev > ../server.log 2>&1 &
SERVER_PID=$!
sleep 3
if curl -s http://localhost:3000/health > /dev/null; then
    echo "   ✅ Backend server running (PID: $SERVER_PID)"
else
    echo "   ❌ Backend server failed to start. Check server.log"
fi
echo ""

# Step 4: Start Worker
echo "👷 Starting SQS worker..."
npx ts-node src/worker.ts > ../worker.log 2>&1 &
WORKER_PID=$!
sleep 1
echo "   ✅ Worker started (PID: $WORKER_PID)"
echo ""

# Step 5: Start Frontend
echo "⚛️  Starting frontend (port 5173)..."
cd ../client
npm run dev > ../client.log 2>&1 &
CLIENT_PID=$!
sleep 3
if curl -s http://localhost:5173 > /dev/null; then
    echo "   ✅ Frontend running (PID: $CLIENT_PID)"
else
    echo "   ❌ Frontend failed to start. Check client.log"
fi
echo ""

echo "=========================================="
echo "✅ All services started!"
echo ""
echo "📍 Access your application:"
echo "   Frontend:        http://localhost:5173"
echo "   Admin Dashboard: http://localhost:5173/admin"
echo "   Backend API:     http://localhost:3000"
echo ""
echo "📊 Logs:"
echo "   Server:  tail -f server.log"
echo "   Worker:  tail -f worker.log"
echo "   Client:  tail -f client.log"
echo ""
echo "🛑 To stop all services:"
echo "   pkill -f 'node.*server'"
echo "   pkill -f 'ts-node.*worker'"
echo "   pkill -f 'vite'"
echo "=========================================="



