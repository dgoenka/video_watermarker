import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { config } from './config';
import { initDb } from './db';
import { startWorker } from './queue';
import { registerRoutes } from './routes';

const fastify = Fastify({ logger: true });

// Register plugins
fastify.register(cors, { origin: '*' });
fastify.register(multipart, { 
  limits: { 
    fileSize: config.maxUploadSize,
    // allow multiple image files (default UI may send more than one)
    files: 20,
    // allow reasonably large JSON field (up to maxUploadSize or 50MB whichever is smaller)
    fieldSize: Math.min(config.maxUploadSize, 50 * 1024 * 1024)
  },
  attachFieldsToBody: false
});

// Register routes
fastify.register(registerRoutes);

// Start server
const start = async () => {
  try {
    await initDb();
    startWorker();
    await fastify.listen({ port: config.port, host: '0.0.0.0' });
    console.log(`Server listening on port ${config.port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
