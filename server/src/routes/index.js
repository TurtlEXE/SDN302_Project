import { Router } from 'express';
import { checkDatabaseHealth } from '../config/database.js';

const router = Router();

/**
 * Health check endpoints under /api/v1
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

router.get('/ready', (req, res) => {
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

router.get('/', (req, res) => {
  res.status(200).json({
    name: 'Sport Booking Platform API',
    version: '1.0.0',
    status: 'running',
    docs: '/api/v1/health',
  });
});

export default router;

