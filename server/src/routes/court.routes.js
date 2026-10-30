import { Router } from 'express';
import { scheduleController } from '../controllers/schedule.controller.js';

const router = Router();

/**
 * Public Court API Routes
 * Mounted at /api/v1/courts
 */

// GET /api/v1/courts/:id/schedule?date=YYYY-MM-DD
router.get('/:id/schedule', scheduleController.getCourtSchedule.bind(scheduleController));

export default router;

