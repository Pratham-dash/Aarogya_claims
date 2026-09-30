import multer from 'multer';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

// Memory storage: files are validated/compressed, then persisted to MongoDB.
export const uploadDocument = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxUploadBytes, files: 1 },
  fileFilter: (_req, file, cb) =>
    ALLOWED.has(file.mimetype) ? cb(null, true) : cb(new ApiError(400, 'Only JPG, PNG, WebP or PDF files are allowed')),
}).single('document');
