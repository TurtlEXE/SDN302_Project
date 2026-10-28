import { AppError } from '../errors/app-error.js';

/**
 * Creates a validation middleware given a validation function or schema
 * @param {(data: any) => { isValid: boolean, details?: Array<{field: string, message: string}> }} validatorFn
 * @param {'body' | 'query' | 'params'} [target='body']
 */
export function validate(validatorFn, target = 'body') {
  return (req, res, next) => {
    try {
      const data = req[target];
      const result = validatorFn(data);

      if (!result.isValid) {
        throw AppError.validationError('Dữ liệu đầu vào không hợp lệ', result.details || []);
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

