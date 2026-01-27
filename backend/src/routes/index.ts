import { FastifyInstance } from 'fastify';
import { uploadRoute } from './upload';
import { statusRoute } from './status';
import { downloadRoute } from './download';
import { retryRoute } from './retry';
import { cancelRoute } from './cancel';
import { healthRoute } from './health';

export async function registerRoutes(fastify: FastifyInstance) {
  await fastify.register(uploadRoute);
  await fastify.register(statusRoute);
  await fastify.register(downloadRoute);
  await fastify.register(retryRoute);
  await fastify.register(cancelRoute);
  await fastify.register(healthRoute);
}