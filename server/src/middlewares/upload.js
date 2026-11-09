import multer from 'multer';
import { AppError } from '../errors/app-error.js';
import { ERROR_CODES } from '../errors/error-codes.js';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        'Định dạng tệp không được hỗ trợ. Chỉ chấp nhận JPG, PNG, WebP.',
        400,
        ERROR_CODES.INVALID_FILE_TYPE
      ),
      false
    );
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter,
});

/**
 * Express middleware for single facility image upload
 * Accepts both 'file' and 'image' multipart field names
 */
export function uploadSingleFacilityImage(req, res, next) {
  const uploadHandler = upload.fields([
    { name: 'file', maxCount: 1 },
    { name: 'image', maxCount: 1 },
  ]);

  uploadHandler(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(
            new AppError(
              'Dung lượng tệp vượt quá giới hạn cho phép (tối đa 5MB).',
              400,
              ERROR_CODES.FILE_TOO_LARGE
            )
          );
        }
        return next(
          new AppError(
            `Lỗi tải tệp: ${err.message}`,
            400,
            ERROR_CODES.VALIDATION_ERROR
          )
        );
      }
      return next(err);
    }

    // Resolve file from either 'file' or 'image' field
    req.file = req.files?.file?.[0] || req.files?.image?.[0] || req.file;

    if (!req.file) {
      return next(
        new AppError(
          'Vui lòng chọn một tệp hình ảnh để tải lên.',
          400,
          ERROR_CODES.VALIDATION_ERROR
        )
      );
    }

    next();
  });
}

