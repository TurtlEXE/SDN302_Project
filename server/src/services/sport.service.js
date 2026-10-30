import { sportRepository } from '../repositories/sport.repository.js';
import { AppError } from '../errors/app-error.js';
import { ERROR_CODES } from '../errors/error-codes.js';

export class SportService {
  /**
   * Create a new sport in the catalog
   * @param {object} input
   * @param {string} input.name
   * @param {string} [input.description]
   * @param {import('mongoose').ClientSession|null} [session=null]
   * @returns {Promise<object>}
   */
  async createSport(input, session = null) {
    const { name, description } = input || {};

    if (!name || typeof name !== 'string' || !name.trim()) {
      throw AppError.badRequest('Tên môn thể thao không được để trống.', ERROR_CODES.VALIDATION_ERROR, [
        { field: 'name', message: 'Tên môn thể thao là bắt buộc.' },
      ]);
    }

    const trimmedName = name.trim();
    const normalizedName = trimmedName.toUpperCase();

    const existing = await sportRepository.findByNormalizedName(normalizedName, session);
    if (existing) {
      throw new AppError('Tên môn thể thao đã tồn tại trong hệ thống.', 409, ERROR_CODES.SPORT_ALREADY_EXISTS);
    }

    const created = await sportRepository.create(
      {
        name: trimmedName,
        normalizedName,
        description: (description || '').trim(),
        isActive: true,
      },
      session
    );

    return sportRepository.toDTO(created);
  }

  /**
   * List active sports for public catalog
   * @returns {Promise<Array<object>>}
   */
  async listActiveSports() {
    return sportRepository.findActiveSports();
  }

  /**
   * List sports for administration with search and pagination
   * @param {object} queryParams
   * @returns {Promise<{ items: Array, pagination: object }>}
   */
  async listAdminSports(queryParams = {}) {
    return sportRepository.findSports(queryParams);
  }

  /**
   * Get single sport details by ID
   * @param {string} id
   * @returns {Promise<object>}
   */
  async getSportById(id) {
    const sport = await sportRepository.findById(id);
    if (!sport) {
      throw new AppError('Không tìm thấy môn thể thao.', 404, ERROR_CODES.SPORT_NOT_FOUND);
    }
    return sportRepository.toDTO(sport);
  }

  /**
   * Update sport details or toggle active status
   * @param {string} id
   * @param {object} input
   * @param {string} [input.name]
   * @param {string} [input.description]
   * @param {boolean} [input.isActive]
   * @param {import('mongoose').ClientSession|null} [session=null]
   * @returns {Promise<object>}
   */
  async updateSport(id, input, session = null) {
    const sport = await sportRepository.findById(id, session);
    if (!sport) {
      throw new AppError('Không tìm thấy môn thể thao.', 404, ERROR_CODES.SPORT_NOT_FOUND);
    }

    const updateData = {};

    if (input.name !== undefined) {
      if (typeof input.name !== 'string' || !input.name.trim()) {
        throw AppError.badRequest('Tên môn thể thao không được để trống.', ERROR_CODES.VALIDATION_ERROR);
      }
      const trimmedName = input.name.trim();
      const normalizedName = trimmedName.toUpperCase();

      if (normalizedName !== sport.normalizedName) {
        const duplicate = await sportRepository.findByNormalizedName(normalizedName, session);
        if (duplicate && duplicate._id.toString() !== id.toString()) {
          throw new AppError('Tên môn thể thao đã tồn tại trong hệ thống.', 409, ERROR_CODES.SPORT_ALREADY_EXISTS);
        }
      }

      updateData.name = trimmedName;
      updateData.normalizedName = normalizedName;
    }

    if (input.description !== undefined) {
      updateData.description = typeof input.description === 'string' ? input.description.trim() : '';
    }

    if (input.isActive !== undefined) {
      const targetIsActive = Boolean(input.isActive);

      // ADM-03: Chỉ cho tắt môn khi không còn sân đang nhận đặt sử dụng môn đó
      if (!targetIsActive && sport.isActive) {
        const hasActiveCourts = await sportRepository.hasActiveCourts(id);
        if (hasActiveCourts) {
          throw new AppError(
            'Không thể tắt môn thể thao khi còn sân con đang hoạt động nhận đặt.',
            400,
            ERROR_CODES.SPORT_IN_USE
          );
        }
      }

      updateData.isActive = targetIsActive;
    }

    const updated = await sportRepository.updateById(id, updateData, session);
    return sportRepository.toDTO(updated);
  }

  /**
   * Soft-delete / delete sport if not in use
   * ADM-03: Không xóa cứng môn đã được sử dụng
   * @param {string} id
   * @param {import('mongoose').ClientSession|null} [session=null]
   * @returns {Promise<void>}
   */
  async deleteSport(id, session = null) {
    const sport = await sportRepository.findById(id, session);
    if (!sport) {
      throw new AppError('Không tìm thấy môn thể thao.', 404, ERROR_CODES.SPORT_NOT_FOUND);
    }

    const inUse = await sportRepository.isSportInUse(id);
    if (inUse) {
      throw new AppError(
        'Không thể xóa môn thể thao đã được sử dụng tại cơ sở hoặc sân.',
        400,
        ERROR_CODES.SPORT_IN_USE
      );
    }

    await sportRepository.deleteById(id, session);
  }
}

export const sportService = new SportService();
export default sportService;

