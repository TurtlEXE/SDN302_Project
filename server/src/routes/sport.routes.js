import { Router } from 'express';
import { sportController } from '../controllers/sport.controller.js';

const router = Router();

// Public routes for active sports catalog
router.get('/', (req, res, next) => {
  sportController.listPublicSports(req, res, next);
});

router.get('/:id', (req, res, next) => {
  sportController.getSportById(req, res, next);
});

export default router;

