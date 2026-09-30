import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

/** Verifies the Bearer token and attaches { id, role, name, email } to req.user. */
export function authenticate(req, _res, next) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) throw new ApiError(401, 'Authentication required');
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    req.user = { id: payload.sub, role: payload.role, name: payload.name, email: payload.email };
    next();
  } catch {
    throw new ApiError(401, 'Your session is invalid or has expired. Please sign in again.');
  }
}

/** Restricts a route to the given roles (must run after authenticate). */
export const requireRole =
  (...roles) =>
  (req, _res, next) =>
    roles.includes(req.user.role) ? next() : next(new ApiError(403, 'You do not have access to this resource'));
