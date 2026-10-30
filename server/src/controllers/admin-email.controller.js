import { emailService } from '../services/email/email.service.js';

export class AdminEmailController {
  constructor(service = emailService) {
    this.emailService = service;
  }

  /**
   * GET /api/v1/admin/email-outbox
   * Retrieves paginated list of email outbox entries with status, eventType, recipient filters
   */
  async listEmailOutbox(req, res, next) {
    try {
      const result = await this.emailService.listOutboxMessages(req.query);
      return res.status(200).json({
        success: true,
        data: result.items,
        pagination: result.pagination,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/admin/email-outbox/:id/retry
   * Admin triggers retry for a failed or pending outbox email
   */
  async retryEmail(req, res, next) {
    try {
      const { id } = req.params;
      const result = await this.emailService.retryMessage(id, req.user);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}

export const adminEmailController = new AdminEmailController();
export default adminEmailController;

