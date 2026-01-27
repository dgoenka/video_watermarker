import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { config } from './config';
import { VideoProcessor } from './processor';
import { getJob, updateJobStatus, updateJobCompleted, JobStatus } from './db';
import { getVideoData, getVideoPath, getOutputPath, saveErrorLog } from './storage';

const connection = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });

export const videoQueue = new Queue('video-processing', { connection });

export function startWorker() {
  const worker = new Worker(
    'video-processing',
    async (job) => {
      const { jobId } = job.data;
      
      try {
        const jobRecord = await getJob(jobId);
        if (!jobRecord) {
          throw new Error('Job not found');
        }
        
        await updateJobStatus(jobId, JobStatus.PROCESSING);
        
        console.log('Starting job processing for:', jobId);
        
        const videoData = await getVideoData(jobId);
        console.log('Video data loaded, nodes count:', videoData.nodes?.length);
        
        const videoPath = await getVideoPath(jobId);
        console.log('Video path:', videoPath);
        
        const outputPath = await getOutputPath(jobId);
        console.log('Output path:', outputPath);
        
        const processor = new VideoProcessor(jobId, videoPath, outputPath, videoData);
        console.log('Processor created, starting processing...');
        
        const { success, result } = await processor.process();
        
        if (success) {
          await updateJobCompleted(jobId);
        } else {
          await updateJobStatus(jobId, JobStatus.FAILED, result);
          await saveErrorLog(jobId, result);
        }
        
        return { success, result };
      } catch (error: any) {
        await updateJobStatus(jobId, JobStatus.FAILED, error.message);
        await saveErrorLog(jobId, error.message);
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
