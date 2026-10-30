import { courtRepository } from '../repositories/court.repository.js';
import { facilityRepository } from '../repositories/facility.repository.js';
import { facilitySportRepository } from '../repositories/facility-sport.repository.js';
import { AppError } from '../errors/app-error.js';
import { ERROR_CODES } from '../errors/error-codes.js';

export class CourtService {
  /**
   * Asserts that court exists and its facility belongs to owner
   */
  async assertOwnerCourt(ownerId, courtId, session = null) {
    const court = await courtRepository.findById(courtId, session);
    if (!court) {
      throw new AppError('Không tìm thấy sân con.', 404, ERROR_CODES.COURT_NOT_FOUND);
    }

    const facility = await facilityRepository.findById(court.facilityId, session);
    if (!facility || facility.ownerId.toString() !== ownerId.toString()) {
      throw new AppError(
        'Bạn không có quyền quản lý sân con này.',
        403,
        ERROR_CODES.FORBIDDEN
      );
    }

    return { court, facility };
  }

  async listOwnerCourts(ownerId, facilityId = null) {
    if (facilityId) {
      const facility = await facilityRepository.findById(facilityId);
      if (!facility || facility.ownerId.toString() !== ownerId.toString()) {
        throw new AppError(
          'Bạn không có quyền quản lý cơ sở thể thao này.',
          403,
          ERROR_CODES.FORBIDDEN
        );
      }

      const courts = await courtRepository.findByFacility(facilityId);
      return courts.map((c) => courtRepository.toDTO(c));
    }

    // List courts across all owner's facilities
    const facilities = await facilityRepository.findByOwner(ownerId);
    const facilityIds = facilities.map((f) => f._id);

    const allCourts = await Promise.all(
      facilityIds.map((id) => courtRepository.findByFacility(id))
    );

    return allCourts.flat().map((c) => courtRepository.toDTO(c));
  }

  async createOwnerCourt(ownerId, data) {
    const { facilitySportId, name, description, pricePerHourVnd } = data;

    if (!facilitySportId) {
      throw new AppError('Cần cung cấp mã nhóm môn tại cơ sở (facilitySportId).', 400, ERROR_CODES.VALIDATION_ERROR);
    }
    if (!name || !name.trim()) {
      throw new AppError('Tên sân con là bắt buộc.', 400, ERROR_CODES.VALIDATION_ERROR);
    }
    const priceNum = Number(pricePerHourVnd);
    if (isNaN(priceNum) || priceNum <= 0) {
      throw new AppError('Đơn giá thuê sân theo giờ phải là số nguyên dương lớn hơn 0.', 400, ERROR_CODES.VALIDATION_ERROR);
    }

    const facilitySport = await facilitySportRepository.findById(facilitySportId);
    if (!facilitySport) {
      throw new AppError('Không tìm thấy nhóm môn thể thao tại cơ sở.', 404, ERROR_CODES.FACILITY_SPORT_NOT_FOUND);
    }

    const facility = await facilityRepository.findById(facilitySport.facilityId);
    if (!facility || facility.ownerId.toString() !== ownerId.toString()) {
      throw new AppError('Bạn không có quyền quản lý cơ sở thể thao này.', 403, ERROR_CODES.FORBIDDEN);
    }

    // Check uniqueness of court name within facility
    const nameExists = await courtRepository.hasCourtWithName(facility._id, name.trim());
    if (nameExists) {
      throw new AppError('Tên sân con đã tồn tại trong cơ sở thể thao này.', 409, ERROR_CODES.COURT_NAME_ALREADY_EXISTS);
    }

    const created = await courtRepository.create({
      facilitySportId: facilitySport._id,
      facilityId: facility._id,
      sportId: facilitySport.sportId._id || facilitySport.sportId,
      name: name.trim(),
      description: (description || '').trim(),
      pricePerHourVnd: Math.round(priceNum),
      priceVersion: 1,
      isActive: true,
    });

    const populated = await courtRepository.findById(created._id);
    return courtRepository.toDTO(populated);
  }

  async updateOwnerCourt(ownerId, courtId, updateData) {
    const { court, facility } = await this.assertOwnerCourt(ownerId, courtId);
    const fieldsToSet = {};

    if (updateData.name !== undefined) {
      const trimmedName = updateData.name.trim();
      if (!trimmedName) {
        throw new AppError('Tên sân con không được để trống.', 400, ERROR_CODES.VALIDATION_ERROR);
      }

      const nameExists = await courtRepository.hasCourtWithName(facility._id, trimmedName, courtId);
      if (nameExists) {
        throw new AppError('Tên sân con đã tồn tại trong cơ sở thể thao này.', 409, ERROR_CODES.COURT_NAME_ALREADY_EXISTS);
      }

      fieldsToSet.name = trimmedName;
    }

    if (updateData.description !== undefined) {
      fieldsToSet.description = updateData.description.trim();
    }

    if (updateData.pricePerHourVnd !== undefined) {
      const priceNum = Number(updateData.pricePerHourVnd);
      if (isNaN(priceNum) || priceNum <= 0) {
        throw new AppError('Đơn giá thuê sân theo giờ phải là số nguyên dương lớn hơn 0.', 400, ERROR_CODES.VALIDATION_ERROR);
      }
      fieldsToSet.pricePerHourVnd = Math.round(priceNum);
    }

    if (updateData.isActive !== undefined) {
      fieldsToSet.isActive = Boolean(updateData.isActive);
    }

    const updated = await courtRepository.updateById(courtId, fieldsToSet);
    return courtRepository.toDTO(updated);
  }
}

export const courtService = new CourtService();
export default courtService;

