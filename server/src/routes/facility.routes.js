import { Router } from 'express';
import { facilityController } from '../controllers/facility.controller.js';
import { scheduleController } from '../controllers/schedule.controller.js';
import { optionalAuthenticate } from '../middlewares/auth.js';

const router = Router();

/**
 * Public Facility Endpoints
 * No authentication required
 */
router.get('/', facilityController.listFacilities.bind(facilityController));
router.get('/:id', facilityController.getFacilityById.bind(facilityController));

// GET /api/v1/facilities/:id/schedule?date=YYYY-MM-DD (B04 consolidated facility schedule)
router.get(
  '/:id/schedule',
  optionalAuthenticate,
  scheduleController.getFacilitySchedule.bind(scheduleController)
);

export default router;

