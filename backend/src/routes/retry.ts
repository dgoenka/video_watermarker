import { FastifyInstance } from 'fastify';
import { promises as fs } from 'fs';
import path from 'path';
import { getJob, updateJobStatus, JobStatus } from '../db';
import { videoQueue } from '../queue';

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
    
    // Check if original video exists
    const uploadPath = path.join('uploads', `${jobId}_retry.mp4`);
    try {
      await fs.access(uploadPath);
      await videoQueue.add('process', { jobId, videoPath: uploadPath });
      
      return {
        job_id: jobId,
        status: 'pending',
        message: 'Job retry initiated',
      };
    } catch {
      return reply.code(400).send({
        error: 'Original video file not found. Please re-upload.',
      });
    }
  });
}