import { sportService } from '../services/sport.service.js';

export class SportController {
  /**
   * Admin creates a new sport in the catalog
   */
  async createSport(req, res, next) {
    try {
      const sport = await sportService.createSport(req.body);
      return res.status(201).json({
        success: true,
        data: sport,
        message: 'Thêm môn thể thao mới thành công.',
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Public list of active sports
   */
  async listPublicSports(req, res, next) {
    try {
      const sports = await sportService.listActiveSports();
      return res.status(200).json({
        success: true,
        data: sports,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin list of sports with pagination and search
   */
  async listAdminSports(req, res, next) {
    try {
      const result = await sportService.listAdminSports(req.query);
      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get single sport details by ID
   */
  async getSportById(req, res, next) {
    try {
      const sport = await sportService.getSportById(req.params.id);
      return res.status(200).json({
        success: true,
        data: sport,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin updates sport name, description or active status
   */
  async updateSport(req, res, next) {
    try {
      const sport = await sportService.updateSport(req.params.id, req.body);
      return res.status(200).json({
        success: true,
        data: sport,
        message: 'Cập nhật môn thể thao thành công.',
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin deletes a sport (only if not in use)
   */
  async deleteSport(req, res, next) {
    try {
      await sportService.deleteSport(req.params.id);
      return res.status(200).json({
        success: true,
        message: 'Xóa môn thể thao thành công.',
      });
    } catch (err) {
      next(err);
    }
  }
}

export const sportController = new SportController();
export default sportController;

