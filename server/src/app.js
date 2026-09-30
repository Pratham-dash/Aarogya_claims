import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import authRoutes from './routes/auth.js';
import claimRoutes from './routes/claims.js';
import documentRoutes from './routes/documents.js';
import { errorHandler, notFound } from './middleware/error.js';

const app = express();

app.set('trust proxy', 1); // Render/Vercel sit behind a proxy (needed for rate limiting by IP)
app.disable('x-powered-by');

//app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-site' } }));
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: env.clientOrigins }));
app.use(compression());
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (_req, res) => {
  const db = mongoose.connection.readyState === 1;
  res.status(db ? 200 : 503).json({ status: db ? 'ok' : 'degraded', db });
});

app.use('/api/auth', authRoutes);
app.use('/api/claims', claimRoutes);
app.use('/api/documents', documentRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
