import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_BASE_DIR = path.resolve(__dirname, '../../uploads');
const FACILITIES_UPLOAD_DIR = path.join(UPLOADS_BASE_DIR, 'facilities');

/**
 * Storage Client for Local Image Persistence
 */
export class StorageClient {
  constructor(facilitiesDir = FACILITIES_UPLOAD_DIR) {
    this.facilitiesDir = facilitiesDir;
    this.ensureDirectoryExists();
  }

  ensureDirectoryExists() {
    if (!fs.existsSync(this.facilitiesDir)) {
      fs.mkdirSync(this.facilitiesDir, { recursive: true });
    }
  }

  /**
   * Saves a facility image to local storage
   * @param {Object} params
   * @param {string} params.facilityId
   * @param {string} params.originalname
   * @param {Buffer} params.buffer
   * @returns {Promise<{ id: string, url: string }>}
   */
  async saveFacilityImage({ facilityId, originalname, buffer }) {
    this.ensureDirectoryExists();
    const imageId = crypto.randomUUID();
    const ext = path.extname(originalname || '').toLowerCase() || '.jpg';
    const sanitizedExt = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.jpg';
    const fileName = `${facilityId}-${imageId}${sanitizedExt}`;
    const filePath = path.join(this.facilitiesDir, fileName);

    await fs.promises.writeFile(filePath, buffer);

    return {
      id: imageId,
      url: `/uploads/facilities/${fileName}`,
    };
  }

  /**
   * Deletes a facility image by its public URL
   * @param {string} imageUrl
   * @returns {Promise<boolean>}
   */
  async deleteFacilityImage(imageUrl) {
    if (!imageUrl || typeof imageUrl !== 'string') return false;
    const fileName = path.basename(imageUrl);
    const filePath = path.join(this.facilitiesDir, fileName);

    try {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        return true;
      }
    } catch {
      // Ignore if file already removed
    }
    return false;
  }
}

export const storageClient = new StorageClient();
export default storageClient;

