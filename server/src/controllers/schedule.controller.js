import { scheduleService } from '../services/booking/schedule.service.js';
import { AppError } from '../errors/app-error.js';
import { ERROR_CODES } from '../errors/error-codes.js';

export class ScheduleController {
  /**
   * GET /api/v1/courts/:id/schedule?date=YYYY-MM-DD
   * Returns CourtScheduleDTO with slot grid and privacy-safe statuses
   */
  async getCourtSchedule(req, res, next) {
    try {
      const { id } = req.params;
      const { date } = req.query;

      if (!date) {
        throw AppError.badRequest(
          'Tham số ngày chơi (date) là bắt buộc định dạng YYYY-MM-DD.',
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      const scheduleDTO = await scheduleService.getCourtSchedule(id, date);

      return res.status(200).json({
        success: true,
        data: scheduleDTO,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const scheduleController = new ScheduleController();
export default scheduleController;

