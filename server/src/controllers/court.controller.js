import { courtService } from '../services/court.service.js';

export class CourtController {
  async listOwnerCourts(req, res, next) {
    try {
      const courts = await courtService.listOwnerCourts(req.user.id, req.query?.facilityId);
      res.status(200).json({
        success: true,
        data: courts,
      });
    } catch (err) {
      next(err);
    }
  }

  async createOwnerCourt(req, res, next) {
    try {
      const court = await courtService.createOwnerCourt(req.user.id, req.body);
      res.status(201).json({
        success: true,
        data: court,
      });
    } catch (err) {
      next(err);
    }
  }

  async updateOwnerCourt(req, res, next) {
    try {
      const updated = await courtService.updateOwnerCourt(req.user.id, req.params.id, req.body);
      res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const courtController = new CourtController();
export default courtController;

