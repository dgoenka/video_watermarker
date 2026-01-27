import { FastifyInstance } from 'fastify';
import { promises as fs } from 'fs';
import { getJob, JobStatus } from '../db';
import { getOutputPath } from '../storage';

export async function downloadRoute(fastify: FastifyInstance) {
  fastify.get('/api/download/:jobId', async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    
    const job = await getJob(jobId);
    if (!job) {
      return reply.code(404).send({ error: 'Job not found' });
    }
    
    if (job.status !== JobStatus.COMPLETED) {
      return reply.code(400).send({
        error: `Job not completed. Current status: ${job.status}`,
      });
    }
    
    try {
      const outputPath = await getOutputPath(jobId);
      await fs.access(outputPath);
      const stream = await fs.readFile(outputPath);
      return reply
        .header('Content-Disposition', `attachment; filename="output.mp4"`)
        .type('video/mp4')
        .send(stream);
    } catch {
      return reply.code(404).send({ error: 'Output file not found' });
    }
  });
}