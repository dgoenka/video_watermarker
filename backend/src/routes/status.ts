import { FastifyInstance } from 'fastify';
import { promises as fs } from 'fs';
import * as path from 'path';
import { getJob } from '../db';
import { config } from '../config';

export async function statusRoute(fastify: FastifyInstance) {
  fastify.get('/api/status/:jobId', async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    
    const job = await getJob(jobId);
    if (!job) {
      return reply.code(404).send({ error: 'Job not found' });
    }
    
    let progress = 0;
    if (job.status === 'processing') {
      const progressPath = path.join(config.outputDir, jobId, `${jobId}_progress.txt`);
      console.log(`[STATUS] Job ${jobId}: Checking progress file at ${progressPath}`);
      try {
        const progressData = await fs.readFile(progressPath, 'utf-8');
        console.log(`[STATUS] Job ${jobId}: Progress file content (first 500 chars): ${progressData.substring(0, 500)}`);
        const timeMatch = progressData.match(/out_time_ms=(\d+)/);
        console.log(`[STATUS] Job ${jobId}: timeMatch result: ${timeMatch ? timeMatch[1] : 'NO MATCH'}`);
        console.log(`[STATUS] Job ${jobId}: video_duration from DB: ${job.video_duration}`);
        if (timeMatch && job.video_duration) {
          const timeMs = parseInt(timeMatch[1]);
          const timeSeconds = timeMs / 1000000;
          progress = Math.min(Math.round((timeSeconds / job.video_duration) * 100), 99);
          console.log(`[STATUS] Job ${jobId}: Calculation - timeMs=${timeMs}, timeSeconds=${timeSeconds}, duration=${job.video_duration}, progress=${progress}`);
        } else {
          console.log(`[STATUS] Job ${jobId}: Cannot calculate progress - timeMatch=${!!timeMatch}, duration=${job.video_duration}`);
        }
      } catch (error) {
        console.log(`[STATUS] Job ${jobId}: Error reading progress file - ${error}`);
      }
    } else if (job.status === 'completed') {
      progress = 100;
    }
    
    console.log(`[STATUS] Job ${jobId}: FINAL RESPONSE - status=${job.status}, progress=${progress}`);
    
    return {
      job_id: job.job_id,
      status: job.status,
      progress,
      error_message: job.error_message,
      created_at: job.created_at,
      updated_at: job.updated_at,
    };
  });
}