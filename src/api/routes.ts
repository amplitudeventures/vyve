import express, { Request, Response, NextFunction } from 'express';
import { adjustAnalysis } from './vyve/adjust-analysis.js';

const router = express.Router();

// Debug middleware for all routes
router.use((req: Request, res: Response, next: NextFunction) => {
  console.log('[API Router] Processing request:', {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    originalUrl: req.originalUrl,
    baseUrl: req.baseUrl,
    matchedRoute: '/api' + req.path,
    headers: req.headers,
    body: req.method === 'POST' ? JSON.stringify(req.body).substring(0, 200) + '...' : undefined
  });
  next();
});

// Vyve Analysis Routes
router.post('/vyve/adjust-analysis', async (req: Request, res: Response, next: NextFunction) => {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[API Router:${requestId}] Handling adjust-analysis request:`, {
    timestamp: new Date().toISOString(),
    path: req.path,
    originalUrl: req.originalUrl,
    baseUrl: req.baseUrl,
    matchedPath: '/vyve/adjust-analysis',
    headers: req.headers,
    bodyKeys: Object.keys(req.body)
  });
  
  try {
    await adjustAnalysis(req, res, next);
  } catch (error) {
    console.error(`[API Router:${requestId}] Error in adjust-analysis:`, {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : error,
      path: req.path,
      originalUrl: req.originalUrl
    });
    next(error);
  }
});

// Catch-all for unmatched routes
router.use((req: Request, res: Response) => {
  console.error('[API Router] Route not found:', {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    originalUrl: req.originalUrl,
    baseUrl: req.baseUrl,
    headers: req.headers
  });
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl,
    availableRoutes: ['/vyve/adjust-analysis']
  });
});

export default router; 