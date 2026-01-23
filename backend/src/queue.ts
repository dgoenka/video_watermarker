import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { config } from './config';
import { VideoProcessor } from './processor';
import { getJob, updateJobStatus, updateJobCompleted, JobStatus } from './db';

const connection = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });

export const videoQueue = new Queue('video-processing', { connection });

export function startWorker() {
  const worker = new Worker(
    'video-processing',
    async (job) => {
      const { jobId, videoPath } = job.data;
      
      try {
        const jobRecord = await getJob(jobId);
        if (!jobRecord) {
          throw new Error('Job not found');
        }
        
        await updateJobStatus(jobId, JobStatus.PROCESSING);
        
        const videoData = JSON.parse(jobRecord.video_data);
        const processor = new VideoProcessor(jobId, videoPath, videoData);
        
        const { success, result } = await processor.process();
        
        if (success) {
          await updateJobCompleted(jobId, result);
        } else {
          await updateJobStatus(jobId, JobStatus.FAILED, result);
        }
        
        return { success, result };
      } catch (error: any) {
        await updateJobStatus(jobId, JobStatus.FAILED, error.message);
        throw error;
      }
    },
    { connection }
  );
  
  worker.on('completed', (job) => {
    console.log(`Job ${job.id} completed`);
  });
  
  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed:`, err);
  });
  
  return worker;
}
