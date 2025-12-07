import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import {
    LineChart,
    Line,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts';
import '../App.css';

const socket = io('http://localhost:3000');

interface Metrics {
    latency: {
        p50: number;
        p95: number;
        p99: number;
    };
    throughput: number;
    orders: {
        total: number;
        successful: number;
        failed: number;
        successRate: number;
    };
    health: {
        status: 'healthy' | 'degraded' | 'unhealthy';
        avgLatency: number;
        errorRate: number;
    };
    timeSeries: Array<{
        time: number;
        throughput: number;
        p50: number;
        p95: number;
        p99: number;
    }>;
}

export default function AdminDashboard() {
    const [stock, setStock] = useState<number | null>(null);
    const [flash, setFlash] = useState(false);
    const [restockAmount, setRestockAmount] = useState(50);
    const [metrics, setMetrics] = useState<Metrics | null>(null);

    useEffect(() => {
        socket.on('connect', () => {
            console.log('Connected to WebSocket');
        });

        socket.on('inventory_update', (data: { productId: string; stock: number }) => {
            console.log('Inventory Update:', data);
            setStock(data.stock);

            // Flash effect
            setFlash(true);
            setTimeout(() => setFlash(false), 200);
        });

        socket.on('metrics_update', (data: Metrics) => {
            setMetrics(data);
        });

        // Fetch initial metrics
        fetchMetrics();

        return () => {
            socket.off('connect');
            socket.off('inventory_update');
            socket.off('metrics_update');
        };
    }, []);

    const fetchMetrics = async () => {
        try {
            const response = await axios.get('/api/metrics');
            setMetrics(response.data);
        } catch (error) {
            console.error('Failed to fetch metrics:', error);
        }
    };

    const handleRestock = async () => {
        try {
            await axios.post('/api/restock', { productId: 'item-123', amount: restockAmount });
            alert('Restock Command Sent');
        } catch (error) {
            console.error('Restock failed', error);
            alert('Restock Failed');
        }
    };

    const handleResetMetrics = async () => {
        try {
            await axios.post('/api/metrics/reset');
            alert('Metrics Reset');
        } catch (error) {
            console.error('Reset failed', error);
        }
    };

    const getHealthColor = (status: string) => {
        switch (status) {
            case 'healthy':
                return '#10b981'; // green
            case 'degraded':
                return '#f59e0b'; // yellow
            case 'unhealthy':
                return '#ef4444'; // red
            default:
                return '#6b7280'; // gray
        }
    };

    const formatTime = (timestamp: number) => {
        return new Date(timestamp).toLocaleTimeString();
    };

    return (
        <div className="container" style={{ padding: '2rem', maxWidth: '1400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1>🛡️ Admin Dashboard</h1>
                <button
                    onClick={handleResetMetrics}
                    style={{
                        padding: '0.5rem 1rem',
                        fontSize: '0.9rem',
                        background: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                    }}
                >
                    Reset Metrics
                </button>
            </div>

            {/* System Health & Key Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                <div className="card" style={{ background: '#1a1a1a' }}>
                    <h3 style={{ marginTop: 0, fontSize: '0.9rem', color: '#9ca3af' }}>System Health</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div
                            style={{
                                width: '12px',
                                height: '12px',
                                borderRadius: '50%',
                                background: metrics?.health ? getHealthColor(metrics.health.status) : '#6b7280',
                            }}
                        />
                        <span style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                            {metrics?.health?.status?.toUpperCase() || 'N/A'}
                        </span>
                    </div>
                    <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: '#6b7280' }}>
                        Avg Latency: {metrics?.health?.avgLatency || 0}ms
                    </p>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: '#6b7280' }}>
                        Error Rate: {metrics?.health?.errorRate || 0}%
                    </p>
                </div>

                <div className="card" style={{ background: '#1a1a1a' }}>
                    <h3 style={{ marginTop: 0, fontSize: '0.9rem', color: '#9ca3af' }}>Throughput</h3>
                    <span style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>
                        {metrics?.throughput || 0}
                    </span>
                    <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: '#6b7280' }}>requests/sec</p>
                </div>

                <div className="card" style={{ background: '#1a1a1a' }}>
                    <h3 style={{ marginTop: 0, fontSize: '0.9rem', color: '#9ca3af' }}>Total Orders</h3>
                    <span style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>
                        {metrics?.orders?.total || 0}
                    </span>
                    <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: '#6b7280' }}>
                        Success Rate: {metrics?.orders?.successRate?.toFixed(1) || 0}%
                    </p>
                </div>

                <div className="card" style={{ background: '#1a1a1a' }}>
                    <h3 style={{ marginTop: 0, fontSize: '0.9rem', color: '#9ca3af' }}>Live Inventory</h3>
                    <div className={`stock-display ${flash ? 'flash-red' : ''}`} style={{ justifyContent: 'center' }}>
                        <span className="count" style={{ fontSize: '2.5rem' }}>
                            {stock !== null ? stock : '...'}
                        </span>
                    </div>
                    <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: '#6b7280' }}>
                        Real-time updates via WebSocket
                    </p>
                </div>
            </div>

            {/* Latency Percentiles */}
            <div className="card" style={{ marginBottom: '2rem', background: '#1a1a1a' }}>
                <h2>Latency Percentiles (Last 60s)</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                    <div style={{ textAlign: 'center', padding: '1rem', background: '#111', borderRadius: '8px' }}>
                        <div style={{ fontSize: '0.9rem', color: '#9ca3af', marginBottom: '0.5rem' }}>P50 (Median)</div>
                        <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#60a5fa' }}>
                            {metrics?.latency?.p50 || 0}ms
                        </div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '1rem', background: '#111', borderRadius: '8px' }}>
                        <div style={{ fontSize: '0.9rem', color: '#9ca3af', marginBottom: '0.5rem' }}>P95</div>
                        <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f59e0b' }}>
                            {metrics?.latency?.p95 || 0}ms
                        </div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '1rem', background: '#111', borderRadius: '8px' }}>
                        <div style={{ fontSize: '0.9rem', color: '#9ca3af', marginBottom: '0.5rem' }}>P99</div>
                        <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ef4444' }}>
                            {metrics?.latency?.p99 || 0}ms
                        </div>
                    </div>
                </div>
            </div>

            {/* Load Test Visualization - Throughput & Latency Over Time */}
            <div className="card" style={{ marginBottom: '2rem', background: '#1a1a1a' }}>
                <h2>Load Test Visualization</h2>
                <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '1rem' }}>
                    Real-time throughput and latency metrics during stress tests
                </p>
                <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={metrics?.timeSeries || []}>
                        <defs>
                            <linearGradient id="colorThroughput" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis
                            dataKey="time"
                            tickFormatter={formatTime}
                            stroke="#9ca3af"
                            style={{ fontSize: '0.75rem' }}
                        />
                        <YAxis yAxisId="left" stroke="#3b82f6" style={{ fontSize: '0.75rem' }} />
                        <YAxis yAxisId="right" orientation="right" stroke="#f59e0b" style={{ fontSize: '0.75rem' }} />
                        <Tooltip
                            contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                            labelFormatter={(value) => `Time: ${formatTime(value)}`}
                        />
                        <Legend />
                        <Area
                            yAxisId="left"
                            type="monotone"
                            dataKey="throughput"
                            stroke="#3b82f6"
                            fillOpacity={1}
                            fill="url(#colorThroughput)"
                            name="Throughput (req/s)"
                        />
                        <Line
                            yAxisId="right"
                            type="monotone"
                            dataKey="p50"
                            stroke="#60a5fa"
                            strokeWidth={2}
                            dot={false}
                            name="P50 Latency (ms)"
                        />
                        <Line
                            yAxisId="right"
                            type="monotone"
                            dataKey="p95"
                            stroke="#f59e0b"
                            strokeWidth={2}
                            dot={false}
                            name="P95 Latency (ms)"
                        />
                        <Line
                            yAxisId="right"
                            type="monotone"
                            dataKey="p99"
                            stroke="#ef4444"
                            strokeWidth={2}
                            dot={false}
                            name="P99 Latency (ms)"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            {/* Order Statistics */}
            <div className="card" style={{ marginBottom: '2rem', background: '#1a1a1a' }}>
                <h2>Order Metrics</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                    <div style={{ textAlign: 'center', padding: '1rem', background: '#111', borderRadius: '8px' }}>
                        <div style={{ fontSize: '0.9rem', color: '#9ca3af', marginBottom: '0.5rem' }}>Successful</div>
                        <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#10b981' }}>
                            {metrics?.orders?.successful || 0}
                        </div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '1rem', background: '#111', borderRadius: '8px' }}>
                        <div style={{ fontSize: '0.9rem', color: '#9ca3af', marginBottom: '0.5rem' }}>Failed</div>
                        <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ef4444' }}>
                            {metrics?.orders?.failed || 0}
                        </div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '1rem', background: '#111', borderRadius: '8px' }}>
                        <div style={{ fontSize: '0.9rem', color: '#9ca3af', marginBottom: '0.5rem' }}>Success Rate</div>
                        <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#60a5fa' }}>
                            {metrics?.orders?.successRate?.toFixed(1) || 0}%
                        </div>
                    </div>
                </div>
            </div>

            {/* Ops Controls */}
            <div className="card" style={{ background: '#1a1a1a' }}>
                <h2>Ops Controls</h2>
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', alignItems: 'center' }}>
                    <input
                        type="number"
                        value={restockAmount}
                        onChange={(e) => setRestockAmount(Number(e.target.value))}
                        style={{
                            padding: '0.5rem',
                            borderRadius: '4px',
                            border: '1px solid #444',
                            background: '#333',
                            color: 'white',
                            width: '100px',
                        }}
                    />
                    <button
                        onClick={handleRestock}
                        style={{
                            padding: '0.5rem 1rem',
                            fontSize: '1rem',
                            background: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                        }}
                    >
                        Restock Inventory
                    </button>
                </div>
            </div>
        </div>
    );
}
