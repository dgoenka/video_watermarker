import { FastifyInstance } from 'fastify';
import { getJob, updateJobStatus, JobStatus } from '../db';
import { videoQueue } from '../queue';
import { cleanupJob } from '../storage';

export async function cancelRoute(fastify: FastifyInstance) {
  fastify.post('/api/cancel/:jobId', async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    
    try {
      const job = await getJob(jobId);
      if (!job) {
        return reply.code(404).send({ error: 'Job not found' });
      }
      
      if (job.status === JobStatus.COMPLETED) {
        return reply.code(400).send({ error: 'Job already completed' });
      }
      
      // Cancel the job in queue
      const jobs = await videoQueue.getJobs(['waiting', 'active']);
      const queueJob = jobs.find(j => j.data.jobId === jobId);
      if (queueJob) {
        await queueJob.remove();
      }
      
      // Update job status
      await updateJobStatus(jobId, JobStatus.FAILED, 'Cancelled by user');
      
      // Cleanup job folder
      await cleanupJob(jobId);
      
      return {
        job_id: jobId,
        status: 'cancelled',
        message: 'Job cancelled successfully',
      };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ error: error.message });
    }
  });
}