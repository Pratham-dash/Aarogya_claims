import mongoose from 'mongoose';
import { env } from './env.js';

mongoose.set('strictQuery', true);

/**
 * Connects with an explicit, bounded connection pool so the API can never
 * open more sockets than the database tier allows (Atlas M0 caps at 500).
 */
export async function connectDb() {
  await mongoose.connect(env.mongoUri, {
    maxPoolSize: env.poolMax,
    minPoolSize: env.poolMin,
    maxIdleTimeMS: 60_000,
    serverSelectionTimeoutMS: 10_000,
    socketTimeoutMS: 45_000,
  });
  console.log(`MongoDB connected (pool ${env.poolMin}-${env.poolMax})`);
}

export const disconnectDb = () => mongoose.connection.close();
