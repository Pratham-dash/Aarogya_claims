import sharp from 'sharp';
import { ApiError } from './ApiError.js';

const MAX_DIMENSION = 1600;

/**
 * Validates and normalises an uploaded file.
 *  - Images are auto-rotated, downscaled to <=1600px and re-encoded as WebP (q75).
 *  - PDFs are stored untouched after a magic-byte check.
 */
export async function processUpload(file) {
  if (file.mimetype === 'application/pdf') {
    if (file.buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
      throw new ApiError(400, 'The uploaded file is not a valid PDF');
    }
    return { data: file.buffer, contentType: 'application/pdf' };
  }
  try {
    const data = await sharp(file.buffer)
      .rotate()
      .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer();
    return { data, contentType: 'image/webp' };
  } catch {
    throw new ApiError(400, 'The uploaded image is corrupt or in an unsupported format');
  }
}
