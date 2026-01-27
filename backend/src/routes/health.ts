import { FastifyInstance } from 'fastify';

export async function healthRoute(fastify: FastifyInstance) {
  fastify.get('/health', async () => {
    return { status: 'healthy' };
  });
}