import { FastifyInstance } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import path from 'path';
import { spawnSync } from 'child_process';
import { createJob } from '../db';
import { videoQueue } from '../queue';
import { createJobFolders, saveVideoData } from '../storage';

export async function uploadRoute(fastify: FastifyInstance) {
  fastify.post('/api/upload', async (request, reply) => {
    try {
      const jobId = uuidv4();
      console.log(`[UPLOAD] Job ${jobId}: Upload started`);
      const { inputVideoDir } = await createJobFolders(jobId);
      
      let videoData: any = null;
      let videoFilename: string | null = null;
      
      // Process all parts
      for await (const part of request.parts()) {
        if (part.type === 'field' && part.fieldname === 'data') {
          videoData = JSON.parse((part as any).value);
          console.log(`[UPLOAD] Job ${jobId}: Parsed videoData with duration=${videoData.video_duration}`);
        } else if (part.type === 'file' && part.fieldname === 'video') {
          videoFilename = part.filename;
          console.log(`[UPLOAD] Job ${jobId}: Received video file: ${videoFilename}`);
          const videoPath = path.join(inputVideoDir, part.filename);
          const writeStream = createWriteStream(videoPath);
          await pipeline(part.file, writeStream);
        }
      }
      
      if (!videoFilename) {
        console.log(`[UPLOAD] Job ${jobId}: No video file uploaded`);
        return reply.code(400).send({ error: 'No video file uploaded' });
      }
      
      if (!videoData) {
        return reply.code(400).send({ error: 'Missing component data' });
      }
      
      // Save video data to input/data.json
      await saveVideoData(jobId, videoData);
      console.log(`[UPLOAD] Job ${jobId}: Saved video data`);
      
      // Extract duration from video file
      const videoPath = path.join(inputVideoDir, videoFilename);
      let videoDuration = videoData.video_duration || 0;
      try {
        const result = spawnSync('ffprobe', [
          '-v', 'error',
          '-show_entries', 'format=duration',
          '-of', 'default=noprint_wrappers=1:nokey=1',
          videoPath
        ], { encoding: 'utf-8' });
        
        if (result.status === 0 && result.stdout.trim()) {
          videoDuration = parseFloat(result.stdout.trim());
          console.log(`[UPLOAD] Job ${jobId}: Extracted duration from file: ${videoDuration}s`);
        } else {
          console.log(`[UPLOAD] Job ${jobId}: ffprobe failed - status=${result.status}, stderr=${result.stderr}`);
        }
      } catch (err: any) {
        console.log(`[UPLOAD] Job ${jobId}: Error running ffprobe: ${err.message}`);
      }
      
      console.log(`[UPLOAD] Job ${jobId}: Creating job record with video_duration=${videoDuration}`);
      
      // Create job record
      await createJob(jobId, videoDuration);
      console.log(`[UPLOAD] Job ${jobId}: Job record created`);
      
      // Queue processing
      console.log(`[UPLOAD] Job ${jobId}: Queuing for processing`);
      await videoQueue.add('process', { jobId });
      console.log(`[UPLOAD] Job ${jobId}: Queued successfully`);
      
      console.log(`[UPLOAD] Job ${jobId}: Upload completed successfully`);
      return {
        job_id: jobId,
        status: 'pending',
        message: 'Video uploaded successfully. Processing started.',
      };
    } catch (error: any) {
      console.error(`[UPLOAD] Error: ${error.message}`);
      fastify.log.error(error);
      return reply.code(500).send({ error: error.message });
    }
  });
}
