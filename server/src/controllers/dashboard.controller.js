import { dashboardService } from '../services/dashboard.service.js';

export class DashboardController {
  constructor(service = dashboardService) {
    this.dashboardService = service;
  }

  /**
   * GET /api/v1/owner/dashboard
   * Retrieves dashboard statistics for the authenticated owner
   */
  async getOwnerDashboard(req, res, next) {
    try {
      const data = await this.dashboardService.getOwnerDashboard(req.user, req.query);
      return res.status(200).json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/admin/dashboard
   * Retrieves overall system operational overview for admin
   */
  async getAdminDashboard(req, res, next) {
    try {
      const data = await this.dashboardService.getAdminDashboard(req.query);
      return res.status(200).json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const dashboardController = new DashboardController();
export default dashboardController;

