# Quick Start Guide - Admin Dashboard with Metrics

## Prerequisites
- Node.js installed
- Docker and Docker Compose installed
- AWS credentials configured (for SQS and DynamoDB) or LocalStack running

## Step 1: Start Infrastructure Services

Start Redis and LocalStack (for AWS services):
```bash
docker-compose up -d
```

This starts:
- Redis on port 6379
- LocalStack on port 4566 (for AWS SQS and DynamoDB)

## Step 2: Start the Backend Server

In a terminal, start the server:
```bash
cd server
npm install  # if not already done
npm run dev
```

The server will run on `http://localhost:3000`

## Step 3: Start the Worker (SQS Processor)

In a **new terminal**, start the worker to process SQS messages:
```bash
cd server
npx ts-node src/worker.ts
```

The worker will continuously poll SQS for messages and save orders to DynamoDB.

## Step 4: Start the Frontend Client

In a **new terminal**, start the React app:
```bash
cd client
npm install  # if not already done
npm run dev
```

The client will run on `http://localhost:5173`

## Step 5: View the Admin Dashboard

Open your browser and navigate to:
```
http://localhost:5173/admin
```

You'll see:
- **System Health** indicator (healthy/degraded/unhealthy)
- **Throughput** (requests per second)
- **Total Orders** and success rate
- **Live Inventory** count
- **Latency Percentiles** (P50, P95, P99)
- **Load Test Visualization** chart showing throughput and latency over time
- **Order Metrics** (successful, failed, success rate)

## Step 6: Run a Stress Test

In a **new terminal**, run the stress test to see metrics in action:
```bash
node stress-test.js
```

Or for more concurrent requests:
```bash
# Edit stress-test.js to increase the number of concurrent requests
# Then run:
node stress-test.js
```

## What You'll See

1. **Real-time Updates**: The dashboard updates every 2 seconds via WebSocket
2. **During Stress Test**:
   - Throughput will spike showing requests/sec
   - Latency percentiles will increase (especially P95 and P99)
   - System health may change from "healthy" to "degraded" or "unhealthy"
   - The chart will show throughput and latency trends over time
   - Order metrics will show successful vs failed orders

3. **Color Coding**:
   - 🟢 Green = Healthy system
   - 🟡 Yellow = Degraded performance
   - 🔴 Red = Unhealthy system

## Troubleshooting

- **No metrics showing?** Make sure the server is running and WebSocket connection is established
- **Worker not processing?** Check AWS credentials and LocalStack is running
- **Redis connection error?** Make sure Docker Compose services are up: `docker-compose ps`

## Reset Metrics

Click the "Reset Metrics" button in the admin dashboard to clear all metrics and start fresh.

