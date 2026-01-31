import { FastifyInstance } from 'fastify';
import { promises as fs } from 'fs';
import { getJob, updateJobStatus, JobStatus } from '../db';
import { videoQueue } from '../queue';
import { getVideoPath } from '../storage';

export async function retryRoute(fastify: FastifyInstance) {
  fastify.post('/api/retry/:jobId', async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    
    const job = await getJob(jobId);
    if (!job) {
      return reply.code(404).send({ error: 'Job not found' });
    }
    
    if (job.status !== JobStatus.FAILED) {
      return reply.code(400).send({
        error: `Job is not in failed state. Current status: ${job.status}`,
      });
    }
    
    // Reset job status
    await updateJobStatus(jobId, JobStatus.PENDING);
    
    try {
      // Use storage helper to locate the original uploaded video inside configured outputDir
      const originalVideoPath = await getVideoPath(jobId);
      await fs.access(originalVideoPath);
      await videoQueue.add('process', { jobId, videoPath: originalVideoPath });

      return {
        job_id: jobId,
        status: 'pending',
        message: 'Job retry initiated',
      };
    } catch (err) {
      // If we couldn't find the original video, ask the user to re-upload
      return reply.code(400).send({
        error: 'Original video file not found. Please re-upload.',
      });
    }
  });
}