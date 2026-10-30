import { facilityService } from '../services/facility.service.js';

export class FacilityController {
  // ==========================================
  // PUBLIC
  // ==========================================

  async listFacilities(req, res, next) {
    try {
      const result = await facilityService.listPublicFacilities(req.query);
      res.status(200).json({
        success: true,
        data: result.items,
        pagination: result.pagination,
      });
    } catch (err) {
      next(err);
    }
  }

  async getFacilityById(req, res, next) {
    try {
      const facility = await facilityService.getPublicFacilityById(req.params.id);
      res.status(200).json({
        success: true,
        data: facility,
      });
    } catch (err) {
      next(err);
    }
  }

  // ==========================================
  // OWNER
  // ==========================================

  async listOwnerFacilities(req, res, next) {
    try {
      const facilities = await facilityService.listOwnerFacilities(req.user.id);
      res.status(200).json({
        success: true,
        data: facilities,
      });
    } catch (err) {
      next(err);
    }
  }

  async createOwnerFacility(req, res, next) {
    try {
      const facility = await facilityService.createFacility(req.user.id, req.body);
      res.status(201).json({
        success: true,
        data: facility,
      });
    } catch (err) {
      next(err);
    }
  }

  async getOwnerFacilityById(req, res, next) {
    try {
      const facility = await facilityService.getOwnerFacilityById(req.user.id, req.params.id);
      res.status(200).json({
        success: true,
        data: facility,
      });
    } catch (err) {
      next(err);
    }
  }

  async updateOwnerFacility(req, res, next) {
    try {
      const updated = await facilityService.updateOwnerFacility(
        req.user.id,
        req.params.id,
        req.body
      );
      res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }

  async uploadFacilityImage(req, res, next) {
    try {
      const isCover = req.body?.isCover === 'true' || req.body?.isCover === true;
      const image = await facilityService.uploadFacilityImage(
        req.user.id,
        req.params.id,
        req.file,
        isCover
      );
      res.status(201).json({
        success: true,
        data: image,
      });
    } catch (err) {
      next(err);
    }
  }

  async deleteFacilityImage(req, res, next) {
    try {
      await facilityService.deleteFacilityImage(
        req.user.id,
        req.params.id,
        req.params.imageId
      );
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  }

  async setCoverImage(req, res, next) {
    try {
      const updated = await facilityService.setCoverImage(
        req.user.id,
        req.params.id,
        req.params.imageId
      );
      res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }

  async listFacilitySports(req, res, next) {
    try {
      const sports = await facilityService.listFacilitySports(req.user.id, req.params.id);
      res.status(200).json({
        success: true,
        data: sports,
      });
    } catch (err) {
      next(err);
    }
  }

  async addFacilitySport(req, res, next) {
    try {
      const created = await facilityService.addFacilitySport(
        req.user.id,
        req.params.id,
        req.body
      );
      res.status(201).json({
        success: true,
        data: created,
      });
    } catch (err) {
      next(err);
    }
  }

  async updateFacilitySportStep(req, res, next) {
    try {
      const updated = await facilityService.updateFacilitySportStep(
        req.user.id,
        req.params.id,
        req.params.facilitySportId,
        req.body
      );
      res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }

  // ==========================================
  // ADMIN
  // ==========================================

  async listAdminFacilities(req, res, next) {
    try {
      const result = await facilityService.listAdminFacilities(req.query);
      res.status(200).json({
        success: true,
        data: result.items,
        pagination: result.pagination,
      });
    } catch (err) {
      next(err);
    }
  }

  async lockFacility(req, res, next) {
    try {
      const locked = await facilityService.lockFacility(
        req.user.id,
        req.params.id,
        req.body?.reason,
        req.ip
      );
      res.status(200).json({
        success: true,
        data: locked,
      });
    } catch (err) {
      next(err);
    }
  }

  async unlockFacility(req, res, next) {
    try {
      const unlocked = await facilityService.unlockFacility(
        req.user.id,
        req.params.id,
        req.ip
      );
      res.status(200).json({
        success: true,
        data: unlocked,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const facilityController = new FacilityController();
export default facilityController;

