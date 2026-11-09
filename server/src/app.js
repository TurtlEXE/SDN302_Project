import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { corsOptions } from './config/cors.js';
import { generalRateLimiter } from './middlewares/rate-limit.js';
import { notFound } from './middlewares/not-found.js';
import { errorHandler } from './middlewares/error-handler.js';
import { checkDatabaseHealth } from './config/database.js';
import { env } from './config/env.js';
import apiRoutes from './routes/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, '../uploads');

const app = express();

// HTTP Hardening & Security Headers
app.use(helmet());

// CORS Configuration
app.use(cors(corsOptions));

// Cookie Parsing
app.use(cookieParser());

// Static uploads serving
const configuredStoragePath = env.STORAGE_LOCAL_PATH || './uploads';
if (path.isAbsolute(configuredStoragePath) && fs.existsSync(configuredStoragePath)) {
  app.use('/uploads/facilities', express.static(configuredStoragePath));
  app.use('/uploads', express.static(configuredStoragePath));
}

const defaultUploadsDir = path.resolve(__dirname, '../uploads');
if (fs.existsSync(defaultUploadsDir)) {
  app.use('/uploads/facilities', express.static(path.join(defaultUploadsDir, 'facilities')));
  app.use('/uploads', express.static(defaultUploadsDir));
}

// Body Parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// General Rate Limiting
app.use(generalRateLimiter);

// Liveness Probe: returns 200 as long as Express server process is up
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Readiness Probe: checks MongoDB connection status
app.get('/ready', (req, res) => {
  const dbHealth = checkDatabaseHealth();
  if (!dbHealth.isConnected) {
    return res.status(503).json({
      status: 'NOT_READY',
      database: dbHealth.state,
      timestamp: new Date().toISOString(),
    });
  }

  return res.status(200).json({
    status: 'READY',
    database: dbHealth.state,
    timestamp: new Date().toISOString(),
  });
});

// Mount API v1 Routes
app.use(env.API_PREFIX, apiRoutes);

// Catch 404 for undefined routes
app.use(notFound);

// Centralized Error Handling
app.use(errorHandler);

export { app };
export default app;
