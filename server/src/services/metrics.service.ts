interface LatencyMetric {
    timestamp: number;
    latency: number;
    endpoint: string;
    status: number;
}

interface OrderMetric {
    timestamp: number;
    success: boolean;
}

class MetricsService {
    private latencyMetrics: LatencyMetric[] = [];
    private orderMetrics: OrderMetric[] = [];
    private readonly MAX_METRICS = 10000; // Keep last 10k metrics
    private readonly WINDOW_MS = 60000; // 1 minute window for calculations

    recordLatency(endpoint: string, latency: number, status: number) {
        const metric: LatencyMetric = {
            timestamp: Date.now(),
            latency,
            endpoint,
            status,
        };
        this.latencyMetrics.push(metric);
        
        // Keep only recent metrics
        if (this.latencyMetrics.length > this.MAX_METRICS) {
            this.latencyMetrics = this.latencyMetrics.slice(-this.MAX_METRICS);
        }
    }

    recordOrder(success: boolean) {
        const metric: OrderMetric = {
            timestamp: Date.now(),
            success,
        };
        this.orderMetrics.push(metric);
        
        if (this.orderMetrics.length > this.MAX_METRICS) {
            this.orderMetrics = this.orderMetrics.slice(-this.MAX_METRICS);
        }
    }

    private getRecentLatencies(windowMs: number = this.WINDOW_MS): number[] {
        const cutoff = Date.now() - windowMs;
        return this.latencyMetrics
            .filter(m => m.timestamp >= cutoff)
            .map(m => m.latency)
            .sort((a, b) => a - b);
    }

    calculatePercentile(latencies: number[], percentile: number): number {
        if (latencies.length === 0) return 0;
        const index = Math.ceil((percentile / 100) * latencies.length) - 1;
        return latencies[Math.max(0, index)] || 0;
    }

    getLatencyPercentiles(): { p50: number; p95: number; p99: number } {
        const latencies = this.getRecentLatencies();
        return {
            p50: this.calculatePercentile(latencies, 50),
            p95: this.calculatePercentile(latencies, 95),
            p99: this.calculatePercentile(latencies, 99),
        };
    }

    getThroughput(windowMs: number = this.WINDOW_MS): number {
        const cutoff = Date.now() - windowMs;
        const recentRequests = this.latencyMetrics.filter(m => m.timestamp >= cutoff);
        return Math.round((recentRequests.length / windowMs) * 1000); // requests per second
    }

    getOrderStats(windowMs: number = this.WINDOW_MS): {
        total: number;
        successful: number;
        failed: number;
        successRate: number;
    } {
        const cutoff = Date.now() - windowMs;
        const recentOrders = this.orderMetrics.filter(m => m.timestamp >= cutoff);
        const successful = recentOrders.filter(m => m.success).length;
        const failed = recentOrders.length - successful;
        
        return {
            total: recentOrders.length,
            successful,
            failed,
            successRate: recentOrders.length > 0 ? (successful / recentOrders.length) * 100 : 0,
        };
    }

    getSystemHealth(): {
        status: 'healthy' | 'degraded' | 'unhealthy';
        avgLatency: number;
        errorRate: number;
    } {
        const latencies = this.getRecentLatencies();
        const recentMetrics = this.latencyMetrics.filter(
            m => m.timestamp >= Date.now() - this.WINDOW_MS
        );
        
        const avgLatency = latencies.length > 0
            ? latencies.reduce((a, b) => a + b, 0) / latencies.length
            : 0;
        
        const errorRate = recentMetrics.length > 0
            ? (recentMetrics.filter(m => m.status >= 400).length / recentMetrics.length) * 100
            : 0;

        let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
        if (avgLatency > 200 || errorRate > 10) {
            status = 'unhealthy';
        } else if (avgLatency > 100 || errorRate > 5) {
            status = 'degraded';
        }

        return {
            status,
            avgLatency: Math.round(avgLatency),
            errorRate: Math.round(errorRate * 100) / 100,
        };
    }

    getTimeSeriesData(windowMs: number = 60000, buckets: number = 20): Array<{
        time: number;
        throughput: number;
        p50: number;
        p95: number;
        p99: number;
    }> {
        const bucketSize = windowMs / buckets;
        const now = Date.now();
        const data: Array<{
            time: number;
            throughput: number;
            p50: number;
            p95: number;
            p99: number;
        }> = [];

        for (let i = buckets - 1; i >= 0; i--) {
            const bucketStart = now - (i + 1) * bucketSize;
            const bucketEnd = now - i * bucketSize;
            
            const bucketMetrics = this.latencyMetrics.filter(
                m => m.timestamp >= bucketStart && m.timestamp < bucketEnd
            );
            
            const latencies = bucketMetrics.map(m => m.latency).sort((a, b) => a - b);
            const throughput = Math.round((bucketMetrics.length / bucketSize) * 1000);
            
            data.push({
                time: bucketEnd,
                throughput,
                p50: this.calculatePercentile(latencies, 50),
                p95: this.calculatePercentile(latencies, 95),
                p99: this.calculatePercentile(latencies, 99),
            });
        }

        return data;
    }

    reset() {
        this.latencyMetrics = [];
        this.orderMetrics = [];
    }
}

export const metricsService = new MetricsService();

