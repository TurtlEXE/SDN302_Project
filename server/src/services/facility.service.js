import { facilityRepository } from '../repositories/facility.repository.js';
import { facilitySportRepository } from '../repositories/facility-sport.repository.js';
import { courtRepository } from '../repositories/court.repository.js';
import { sportRepository } from '../repositories/sport.repository.js';
import { actionLogRepository } from '../repositories/action-log.repository.js';
import { storageClient } from '../integrations/storage.client.js';
import { withTransaction } from '../database/transaction.js';
import { parsePagination, formatPaginatedResponse } from '../utils/pagination.js';
import { validateOperatingHours, hasAtLeastOneFullSlot } from '../utils/date-time.js';
import { AppError } from '../errors/app-error.js';
import { ERROR_CODES } from '../errors/error-codes.js';

export class FacilityService {
  /**
   * Asserts that facility exists and belongs to the specified owner
   */
  async assertOwnerFacility(ownerId, facilityId, session = null) {
    const facility = await facilityRepository.findById(facilityId, session);
    if (!facility) {
      throw new AppError('Không tìm thấy cơ sở thể thao.', 404, ERROR_CODES.FACILITY_NOT_FOUND);
    }

    if (facility.ownerId.toString() !== ownerId.toString()) {
      throw new AppError(
        'Bạn không có quyền quản lý cơ sở thể thao này.',
        403,
        ERROR_CODES.FORBIDDEN
      );
    }

    return facility;
  }

  // ==========================================
  // OWNER FACILITY MANAGEMENT
  // ==========================================

  async createFacility(ownerId, data) {
    const { name, description, address, province, phoneNumber, openTime = '06:00', closeTime = '22:00' } = data;

    if (!name || !name.trim()) {
      throw new AppError('Tên cơ sở thể thao là bắt buộc.', 400, ERROR_CODES.VALIDATION_ERROR);
    }
    if (!address || !address.trim()) {
      throw new AppError('Địa chỉ cơ sở thể thao là bắt buộc.', 400, ERROR_CODES.VALIDATION_ERROR);
    }
    if (!province || !province.trim()) {
      throw new AppError('Tỉnh/thành phố là bắt buộc.', 400, ERROR_CODES.VALIDATION_ERROR);
    }
    if (!phoneNumber || !phoneNumber.trim()) {
      throw new AppError('Số điện thoại liên hệ là bắt buộc.', 400, ERROR_CODES.VALIDATION_ERROR);
    }

    try {
      validateOperatingHours(openTime, closeTime);
    } catch (err) {
      throw new AppError(err.message, 400, ERROR_CODES.VALIDATION_ERROR);
    }

    const facility = await facilityRepository.create({
      ownerId,
      name: name.trim(),
      description: (description || '').trim(),
      address: address.trim(),
      province: province.trim(),
      phoneNumber: phoneNumber.trim(),
      openTime,
      closeTime,
      operatingHoursVersion: 1,
      status: 'DRAFT',
      isLockedByAdmin: false,
      lockReason: null,
      images: [],
    });

    return facilityRepository.toDTO(facility);
  }

  async listOwnerFacilities(ownerId) {
    const facilities = await facilityRepository.findByOwner(ownerId);
    const result = [];

    for (const fac of facilities) {
      const activeCourts = await courtRepository.findActiveByFacility(fac._id);
      const minPrice =
        activeCourts.length > 0
          ? Math.min(...activeCourts.map((c) => c.pricePerHourVnd))
          : null;
      result.push(facilityRepository.toDTO(fac, minPrice));
    }

    return result;
  }

  async getOwnerFacilityById(ownerId, facilityId) {
    const facility = await this.assertOwnerFacility(ownerId, facilityId);
    const [facilitySports, courts, activeCourts] = await Promise.all([
      facilitySportRepository.findByFacility(facilityId),
      courtRepository.findByFacility(facilityId),
      courtRepository.findActiveByFacility(facilityId),
    ]);

    const minPrice =
      activeCourts.length > 0
        ? Math.min(...activeCourts.map((c) => c.pricePerHourVnd))
        : null;

    return facilityRepository.toDetailDTO(
      facility,
      facilitySports.map((fs) => facilitySportRepository.toDTO(fs)),
      courts.map((c) => courtRepository.toDTO(c)),
      minPrice
    );
  }

  async updateOwnerFacility(ownerId, facilityId, updateData) {
    const facility = await this.assertOwnerFacility(ownerId, facilityId);
    const fieldsToSet = {};

    if (updateData.name !== undefined) fieldsToSet.name = updateData.name.trim();
    if (updateData.description !== undefined) fieldsToSet.description = updateData.description.trim();
    if (updateData.address !== undefined) fieldsToSet.address = updateData.address.trim();
    if (updateData.province !== undefined) fieldsToSet.province = updateData.province.trim();
    if (updateData.phoneNumber !== undefined) fieldsToSet.phoneNumber = updateData.phoneNumber.trim();

    // Check transition to PUBLISHED: requires at least 1 active court
    if (updateData.status !== undefined) {
      if (!['DRAFT', 'PUBLISHED', 'PAUSED'].includes(updateData.status)) {
        throw new AppError('Trạng thái cơ sở không hợp lệ.', 400, ERROR_CODES.VALIDATION_ERROR);
      }

      if (updateData.status === 'PUBLISHED') {
        const hasActive = await courtRepository.hasActiveCourt(facilityId);
        if (!hasActive) {
          throw new AppError(
            'Cơ sở phải có ít nhất một sân con đang nhận đặt để có thể công khai.',
            400,
            ERROR_CODES.FACILITY_CANNOT_PUBLISH
          );
        }
      }
      fieldsToSet.status = updateData.status;
    }

    // Check operating hours updates and guard active schedules
    if (updateData.openTime !== undefined || updateData.closeTime !== undefined) {
      const newOpenTime = updateData.openTime || facility.openTime;
      const newCloseTime = updateData.closeTime || facility.closeTime;

      try {
        validateOperatingHours(newOpenTime, newCloseTime);
      } catch (err) {
        throw new AppError(err.message, 400, ERROR_CODES.VALIDATION_ERROR);
      }

      // Verify that every configured FacilitySport can still produce at least one full slot
      const configuredSports = await facilitySportRepository.findByFacility(facilityId);
      for (const fs of configuredSports) {
        if (!hasAtLeastOneFullSlot(newOpenTime, newCloseTime, fs.slotStepMinutes)) {
          throw new AppError(
            `Khung giờ hoạt động không đủ cho môn ${fs.sportId?.name || ''} với bước giờ ${fs.slotStepMinutes} phút.`,
            400,
            ERROR_CODES.VALIDATION_ERROR
          );
        }
      }

      // Guard (Criterion 15): Operating hours change is rejected if facility has active/unexpired bookings or blocks
      const allCourts = await courtRepository.findByFacility(facilityId);
      const courtIds = allCourts.map((c) => c._id);
      const scheduleGuard = await courtRepository.checkActiveSchedulesForCourts(courtIds);

      if (scheduleGuard.hasActiveSchedules) {
        throw new AppError(
          'Không thể thay đổi giờ hoạt động vì cơ sở đang có đơn đặt hoặc lịch khóa chưa kết thúc.',
          409,
          ERROR_CODES.FACILITY_HAS_ACTIVE_BOOKINGS
        );
      }

      fieldsToSet.openTime = newOpenTime;
      fieldsToSet.closeTime = newCloseTime;
      fieldsToSet.operatingHoursVersion = (facility.operatingHoursVersion || 1) + 1;
    }

    const updated = await facilityRepository.updateById(facilityId, fieldsToSet);
    return facilityRepository.toDTO(updated);
  }

  // ==========================================
  // FACILITY IMAGES
  // ==========================================

  async uploadFacilityImage(ownerId, facilityId, file, isCover = false) {
    const facility = await this.assertOwnerFacility(ownerId, facilityId);

    if (facility.images && facility.images.length >= 10) {
      throw new AppError(
        'Mỗi cơ sở thể thao chỉ được tải lên tối đa 10 hình ảnh.',
        400,
        ERROR_CODES.IMAGE_LIMIT_EXCEEDED
      );
    }

    const saved = await storageClient.saveFacilityImage({
      facilityId,
      originalname: file.originalname,
      buffer: file.buffer,
    });

    const shouldBeCover = Boolean(isCover) || !facility.images || facility.images.length === 0;

    const newImage = {
      id: saved.id,
      url: saved.url,
      isCover: shouldBeCover,
      order: (facility.images || []).length,
    };

    if (shouldBeCover && facility.images && facility.images.length > 0) {
      facility.images.forEach((img) => {
        img.isCover = false;
      });
    }

    facility.images.push(newImage);
    await facility.save();

    return newImage;
  }

  async deleteFacilityImage(ownerId, facilityId, imageId) {
    const facility = await this.assertOwnerFacility(ownerId, facilityId);
    const imageIndex = facility.images.findIndex((img) => img.id === imageId);

    if (imageIndex === -1) {
      throw new AppError('Không tìm thấy hình ảnh cần xóa.', 404, ERROR_CODES.IMAGE_NOT_FOUND);
    }

    const [deletedImage] = facility.images.splice(imageIndex, 1);
    await storageClient.deleteFacilityImage(deletedImage.url);

    // If deleted image was cover, reassign cover to the first remaining image
    if (deletedImage.isCover && facility.images.length > 0) {
      facility.images[0].isCover = true;
    }

    await facility.save();
    return true;
  }

  async setCoverImage(ownerId, facilityId, imageId) {
    const facility = await this.assertOwnerFacility(ownerId, facilityId);
    const targetImage = facility.images.find((img) => img.id === imageId);

    if (!targetImage) {
      throw new AppError('Không tìm thấy hình ảnh để đặt làm ảnh đại diện.', 404, ERROR_CODES.IMAGE_NOT_FOUND);
    }

    facility.images.forEach((img) => {
      img.isCover = img.id === imageId;
    });

    await facility.save();
    return facilityRepository.toDTO(facility);
  }

  // ==========================================
  // FACILITY SPORTS & SLOT STEPS
  // ==========================================

  async listFacilitySports(ownerId, facilityId) {
    await this.assertOwnerFacility(ownerId, facilityId);
    const facilitySports = await facilitySportRepository.findByFacility(facilityId);
    return facilitySports.map((fs) => facilitySportRepository.toDTO(fs));
  }

  async addFacilitySport(ownerId, facilityId, { sportId, slotStepMinutes }) {
    const facility = await this.assertOwnerFacility(ownerId, facilityId);
    const stepNum = Number(slotStepMinutes);

    if (![30, 60, 90].includes(stepNum)) {
      throw new AppError(
        'Bước giờ cấu hình phải là 30, 60 hoặc 90 phút.',
        400,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // Check sport existence and active status
    const sport = await sportRepository.findById(sportId);
    if (!sport || !sport.isActive) {
      throw new AppError(
        'Môn thể thao không tồn tại hoặc đang bị tạm dừng.',
        400,
        ERROR_CODES.SPORT_NOT_FOUND
      );
    }

    // Check compound uniqueness
    const existing = await facilitySportRepository.findByFacilityAndSport(facilityId, sportId);
    if (existing) {
      throw new AppError(
        'Môn thể thao này đã được cấu hình tại cơ sở.',
        409,
        ERROR_CODES.FACILITY_SPORT_ALREADY_EXISTS
      );
    }

    // Check if facility hours accommodate this step
    if (!hasAtLeastOneFullSlot(facility.openTime, facility.closeTime, stepNum)) {
      throw new AppError(
        `Giờ hoạt động (${facility.openTime}-${facility.closeTime}) không đủ cho một bước giờ ${stepNum} phút.`,
        400,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    const created = await facilitySportRepository.create({
      facilityId,
      sportId,
      slotStepMinutes: stepNum,
      configVersion: 1,
    });

    return facilitySportRepository.toDTO(created, sport.name);
  }

  async updateFacilitySportStep(ownerId, facilityId, facilitySportId, { slotStepMinutes }) {
    const facility = await this.assertOwnerFacility(ownerId, facilityId);
    const stepNum = Number(slotStepMinutes);

    if (![30, 60, 90].includes(stepNum)) {
      throw new AppError(
        'Bước giờ cấu hình phải là 30, 60 hoặc 90 phút.',
        400,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    const facilitySport = await facilitySportRepository.findById(facilitySportId);
    if (!facilitySport || facilitySport.facilityId.toString() !== facilityId.toString()) {
      throw new AppError(
        'Không tìm thấy cấu hình môn thể thao tại cơ sở này.',
        404,
        ERROR_CODES.FACILITY_SPORT_NOT_FOUND
      );
    }

    // Check if facility hours accommodate new step
    if (!hasAtLeastOneFullSlot(facility.openTime, facility.closeTime, stepNum)) {
      throw new AppError(
        `Giờ hoạt động (${facility.openTime}-${facility.closeTime}) không đủ cho một bước giờ ${stepNum} phút.`,
        400,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // Guard (Criterion 15): Step update is rejected if any court in this FacilitySport has active schedules
    const courts = await courtRepository.findByFacilitySport(facilitySportId);
    const courtIds = courts.map((c) => c._id);
    const scheduleGuard = await courtRepository.checkActiveSchedulesForCourts(courtIds);

    if (scheduleGuard.hasActiveSchedules) {
      throw new AppError(
        'Không thể thay đổi bước giờ vì nhóm môn đang có đơn đặt hoặc lịch khóa chưa kết thúc.',
        409,
        ERROR_CODES.FACILITY_HAS_ACTIVE_BOOKINGS
      );
    }

    const updated = await facilitySportRepository.updateStep(facilitySportId, stepNum);
    return facilitySportRepository.toDTO(updated);
  }

  // ==========================================
  // PUBLIC SEARCH & DETAILS
  // ==========================================

  async listPublicFacilities(queryParams) {
    const { page, limit, skip } = parsePagination(queryParams, 10, 50);
    const { keyword, province, sportId, minPrice, maxPrice, sort } = queryParams;

    const [facilities, total] = await Promise.all([
      facilityRepository.findPublicFacilities({
        keyword,
        province,
        sportId,
        minPrice,
        maxPrice,
        sort,
        skip,
        limit,
      }),
      facilityRepository.countPublicFacilities({
        keyword,
        province,
        sportId,
        minPrice,
        maxPrice,
      }),
    ]);

    const items = facilities.map((f) => facilityRepository.toDTO(f, f.minPricePerHour));
    return formatPaginatedResponse(items, total, page, limit);
  }

  async getPublicFacilityById(facilityId) {
    const facility = await facilityRepository.findById(facilityId);

    if (!facility || facility.status !== 'PUBLISHED' || facility.isLockedByAdmin) {
      throw new AppError(
        'Không tìm thấy cơ sở thể thao công khai.',
        404,
        ERROR_CODES.FACILITY_NOT_FOUND
      );
    }

    const [facilitySports, courts] = await Promise.all([
      facilitySportRepository.findByFacility(facilityId),
      courtRepository.findActiveByFacility(facilityId),
    ]);

    const minPrice =
      courts.length > 0 ? Math.min(...courts.map((c) => c.pricePerHourVnd)) : null;

    return facilityRepository.toDetailDTO(
      facility,
      facilitySports.map((fs) => facilitySportRepository.toDTO(fs)),
      courts.map((c) => courtRepository.toDTO(c)),
      minPrice
    );
  }

  // ==========================================
  // ADMIN FACILITY MANAGEMENT
  // ==========================================

  async listAdminFacilities(queryParams) {
    const { page, limit, skip } = parsePagination(queryParams, 10, 50);
    const { search, status, isLockedByAdmin, province, ownerId } = queryParams;

    const [facilities, total] = await Promise.all([
      facilityRepository.findAllAdmin({
        search,
        status,
        isLockedByAdmin,
        province,
        ownerId,
        skip,
        limit,
      }),
      facilityRepository.countAllAdmin({
        search,
        status,
        isLockedByAdmin,
        province,
        ownerId,
      }),
    ]);

    const items = facilities.map((f) => facilityRepository.toDTO(f));
    return formatPaginatedResponse(items, total, page, limit);
  }

  async lockFacility(adminId, facilityId, reason, ipAddress = null) {
    if (!reason || !reason.trim()) {
      throw new AppError('Lý do khóa cơ sở thể thao là bắt buộc.', 400, ERROR_CODES.VALIDATION_ERROR);
    }

    const facility = await facilityRepository.findById(facilityId);
    if (!facility) {
      throw new AppError('Không tìm thấy cơ sở thể thao.', 404, ERROR_CODES.FACILITY_NOT_FOUND);
    }

    return withTransaction(async (session) => {
      const updated = await facilityRepository.lockFacility(facilityId, reason.trim(), session);

      await actionLogRepository.create(
        {
          actorId: adminId,
          actorRole: 'ADMIN',
          targetType: 'FACILITY',
          targetId: facilityId,
          action: 'LOCK_FACILITY',
          reason: reason.trim(),
          previousState: { isLockedByAdmin: facility.isLockedByAdmin, lockReason: facility.lockReason },
          newState: { isLockedByAdmin: true, lockReason: reason.trim() },
          ipAddress,
        },
        session
      );

      return facilityRepository.toDTO(updated);
    });
  }

  async unlockFacility(adminId, facilityId, ipAddress = null) {
    const facility = await facilityRepository.findById(facilityId);
    if (!facility) {
      throw new AppError('Không tìm thấy cơ sở thể thao.', 404, ERROR_CODES.FACILITY_NOT_FOUND);
    }

    return withTransaction(async (session) => {
      const updated = await facilityRepository.unlockFacility(facilityId, session);

      await actionLogRepository.create(
        {
          actorId: adminId,
          actorRole: 'ADMIN',
          targetType: 'FACILITY',
          targetId: facilityId,
          action: 'UNLOCK_FACILITY',
          reason: null,
          previousState: { isLockedByAdmin: facility.isLockedByAdmin, lockReason: facility.lockReason },
          newState: { isLockedByAdmin: false, lockReason: null },
          ipAddress,
        },
        session
      );

      return facilityRepository.toDTO(updated);
    });
  }
}

export const facilityService = new FacilityService();
export default facilityService;
