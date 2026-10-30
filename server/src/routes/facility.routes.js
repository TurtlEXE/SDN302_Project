import { Router } from 'express';
import { facilityController } from '../controllers/facility.controller.js';

const router = Router();

/**
 * Public Facility Endpoints
 * No authentication required
 */
router.get('/', facilityController.listFacilities.bind(facilityController));
router.get('/:id', facilityController.getFacilityById.bind(facilityController));

export default router;

