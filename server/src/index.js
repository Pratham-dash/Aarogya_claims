import app from './app.js';
import { env } from './config/env.js';
import { connectDb, disconnectDb } from './config/db.js';
import { User } from './models/User.js';
import { Claim } from './models/Claim.js';
import { DocumentFile } from './models/Document.js';
import { seedDemoData } from './seed.js';

await connectDb();
await Promise.all([User.init(), Claim.init(), DocumentFile.init()]); // make sure indexes exist before serving
if (env.seedOnStart) await seedDemoData();

const server = app.listen(env.port, () => console.log(`API listening on :${env.port} (${env.nodeEnv})`));

const shutdown = (signal) => {
  console.log(`${signal} received, shutting down`);
  server.close(async () => {
    await disconnectDb();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
};
['SIGINT', 'SIGTERM'].forEach((s) => process.on(s, () => shutdown(s)));
