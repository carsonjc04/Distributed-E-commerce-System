import { Request, Response, NextFunction } from 'express';
import { metricsService } from '../services/metrics.service';

export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const endpoint = `${req.method} ${req.path}`;

    // Override res.end to capture response time
    const originalEnd = res.end.bind(res);
    res.end = function(chunk?: any, encoding?: any): Response {
        const latency = Date.now() - startTime;
        metricsService.recordLatency(endpoint, latency, res.statusCode);
        return originalEnd(chunk, encoding);
    };

    next();
};

