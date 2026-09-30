import 'dotenv/config';

const missing = ['MONGODB_URI', 'JWT_SECRET'].filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing required environment variable(s): ${missing.join(', ')}. See server/.env.example`);
  process.exit(1);
}

const num = (value, fallback) => (value !== undefined && Number.isFinite(Number(value)) ? Number(value) : fallback);

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: num(process.env.PORT, 5000),
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  clientOrigins: (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map((s) => s.trim()),
  seedOnStart: process.env.SEED_ON_START === 'true',
  poolMax: num(process.env.DB_POOL_MAX, 20),
  poolMin: num(process.env.DB_POOL_MIN, 2),
  maxUploadBytes: num(process.env.MAX_UPLOAD_MB, 10) * 1024 * 1024,
};
