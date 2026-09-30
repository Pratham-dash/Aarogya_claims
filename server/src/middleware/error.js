import { ZodError } from 'zod';
import multer from 'multer';
import mongoose from 'mongoose';
import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.js';

export const notFound = (req, _res, next) => next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  let status = 500;
  let message = 'Something went wrong on our side. Please try again.';
  let details;

  if (err instanceof ApiError) {
    ({ status, message, details } = err);
  } else if (err instanceof ZodError) {
    status = 400;
    message = 'Validation failed';
    details = err.issues.map((i) => ({ field: i.path.join('.') || 'body', message: i.message }));
  } else if (err instanceof multer.MulterError) {
    status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? `File is too large (max ${env.maxUploadBytes / 1024 / 1024} MB)` : err.message;
    details = [{ field: 'document', message }];
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    message = 'Invalid identifier';
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Request body is not valid JSON';
  }

  if (status >= 500) console.error(err);
  res.status(status).json({ error: { message, ...(details && { details }) } });
}
