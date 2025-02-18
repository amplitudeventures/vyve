import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import router from './api/routes.js';

const app = express();

// Middleware
app.use(morgan('dev'));
app.use(cors());
app.use(express.json());

// Debug middleware
app.use((req, res, next) => {
  console.log('[App] Incoming request:', {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    headers: req.headers
  });
  next();
});

// Routes
app.use('/api', router);

// 404 handler
app.use((req, res) => {
  console.warn('[App] 404 Not Found:', {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path
  });
  res.status(404).json({ error: 'Not Found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[App] Error:', {
    timestamp: new Date().toISOString(),
    error: err instanceof Error ? {
      name: err.name,
      message: err.message,
      stack: err.stack
    } : err,
    method: req.method,
    path: req.path
  });
  
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal Server Error',
      status: err.status || 500
    }
  });
});

export default app; 