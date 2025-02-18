import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { resolveRoot } from './paths.js';
import router from './api/routes.js';

// Load environment variables from the root .env file
dotenv.config({ path: resolveRoot('.env') });

// Validate required environment variables
const requiredEnvVars = ['OPENAI_API_KEY'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error('Missing required environment variables:', missingEnvVars);
  console.error('Please create a .env file in the project root with the following variables:');
  console.error(requiredEnvVars.map(envVar => `${envVar}=your_${envVar.toLowerCase()}_here`).join('\n'));
  process.exit(1);
}

// Validate OpenAI API key format
const openaiApiKey = process.env.OPENAI_API_KEY;
if (!openaiApiKey?.startsWith('sk-') || openaiApiKey.length < 40) {
  console.error('Invalid OpenAI API key format. The key should start with "sk-" and be at least 40 characters long.');
  process.exit(1);
}

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: ['http://localhost:8080', 'http://localhost:5173', 'http://localhost:3000', 'http://localhost:8000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  credentials: true,
  maxAge: 86400 // Cache preflight requests for 24 hours
}));
app.use(morgan('dev'));
app.use(express.json());

// Routes
app.use('/api', router);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Global error handler:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log('Environment:', process.env.NODE_ENV);
  console.log('OpenAI API key status: Configured');
}); 