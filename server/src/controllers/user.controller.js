import { userRepository } from '../repositories/user.repository.js';
import { AppError } from '../errors/app-error.js';
import { ERROR_CODES } from '../errors/error-codes.js';

export class UserController {
  /**
   * Get current authenticated user profile
   */
  async getProfile(req, res, next) {
    try {
      return res.status(200).json({
        success: true,
        data: userRepository.toUserDTO(req.user),
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Update current authenticated user profile (fullName, phoneNumber only)
   */
  async updateProfile(req, res, next) {
    try {
      const { fullName, phoneNumber } = req.body || {};
      const updateData = {};

      if (fullName !== undefined) {
        if (typeof fullName !== 'string' || !fullName.trim()) {
          throw AppError.badRequest('Họ và tên không hợp lệ.', ERROR_CODES.VALIDATION_ERROR);
        }
        updateData.fullName = fullName.trim();
      }

      if (phoneNumber !== undefined) {
        if (typeof phoneNumber !== 'string' || !phoneNumber.trim()) {
          throw AppError.badRequest('Số điện thoại không hợp lệ.', ERROR_CODES.VALIDATION_ERROR);
        }
        updateData.phoneNumber = phoneNumber.trim();
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(200).json({
          success: true,
          data: userRepository.toUserDTO(req.user),
        });
      }

      const updatedUser = await userRepository.updateById(req.user._id, updateData);

      return res.status(200).json({
        success: true,
        data: userRepository.toUserDTO(updatedUser),
      });
    } catch (err) {
      next(err);
    }
  }
}

export const userController = new UserController();
export default userController;
