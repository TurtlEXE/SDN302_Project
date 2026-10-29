import { Router } from 'express';
import { checkDatabaseHealth } from '../config/database.js';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import adminRoutes from './admin.routes.js';

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

// Authentication routes
router.use('/auth', authRoutes);

// User profile routes
router.use('/users', userRoutes);

// Admin management routes
router.use('/admin', adminRoutes);

export default router;
