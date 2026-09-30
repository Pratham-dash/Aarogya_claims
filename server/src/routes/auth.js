import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { User } from '../models/User.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many login attempts. Try again in a few minutes.' } },
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

// POST /api/auth/login  -> { token, user }
router.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const user = await User.findOne({ email }).lean();
    const ok = user && (await bcrypt.compare(password, user.passwordHash));
    if (!ok) throw new ApiError(401, 'Incorrect email or password');

    const token = jwt.sign({ role: user.role, name: user.name, email: user.email }, env.jwtSecret, {
      subject: String(user._id),
      expiresIn: env.jwtExpiresIn,
    });
    res.json({ token, user: { id: String(user._id), name: user.name, email: user.email, role: user.role } });
  }),
);

// GET /api/auth/me  -> { user }   (validates a stored token)
router.get('/me', authenticate, (req, res) => res.json({ user: req.user }));

export default router;
