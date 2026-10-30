import { courtBlockService } from '../services/booking/court-block.service.js';

export class CourtBlockController {
  /**
   * POST /api/v1/owner/court-blocks
   * Owner creates court blocks (maintenance/emergency blocking)
   */
  async createCourtBlock(req, res, next) {
    try {
      const result = await courtBlockService.createCourtBlock(req.user, req.body);
      return res.status(201).json({
        success: true,
        message: 'Tạo lịch khóa sân thành công.',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/v1/owner/court-blocks/:id
   * Owner reopens locked schedule
   */
  async deleteCourtBlock(req, res, next) {
    try {
      await courtBlockService.deleteCourtBlock(req.user, req.params.id);
      return res.status(204).send();
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/owner/court-blocks
   * Owner lists court blocks
   */
  async listCourtBlocks(req, res, next) {
    try {
      const result = await courtBlockService.listCourtBlocks(req.user, req.query);
      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const courtBlockController = new CourtBlockController();
export default courtBlockController;

