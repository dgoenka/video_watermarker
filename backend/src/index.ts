import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import path from 'path';
import { config } from './config';
import { initDb, createJob, getJob, updateJobStatus, JobStatus } from './db';
import { videoQueue, startWorker } from './queue';

const fastify = Fastify({ logger: true });

// Register plugins
fastify.register(cors, { origin: '*' });
fastify.register(multipart, { limits: { fileSize: config.maxUploadSize } });

// Upload endpoint
fastify.post('/api/upload', async (request, reply) => {
  try {
    const data = await request.file();
    if (!data) {
      return reply.code(400).send({ error: 'No file uploaded' });
    }
    
    const fields: any = {};
    for await (const part of request.parts()) {
      if (part.type === 'field') {
        fields[part.fieldname] = (part as any).value;
      }
    }
    
    if (!fields.data) {
      return reply.code(400).send({ error: 'Missing component data' });
    }
    
    const videoData = JSON.parse(fields.data);
    const jobId = uuidv4();
    
    // Save uploaded video
    await fs.mkdir('uploads', { recursive: true });
    const uploadPath = path.join('uploads', `${jobId}_${data.filename}`);
    await fs.writeFile(uploadPath, await data.toBuffer());
    
    // Create job record
    const outputPath = path.join(config.outputDir, `${jobId}.mp4`);
    await createJob(jobId, outputPath, videoData);
    
    // Queue processing
    await videoQueue.add('process', { jobId, videoPath: uploadPath });
    
    return {
      job_id: jobId,
      status: 'pending',
      message: 'Video uploaded successfully. Processing started.',
    };
  } catch (error: any) {
    fastify.log.error(error);
    return reply.code(500).send({ error: error.message });
  }
});

// Status endpoint
fastify.get('/api/status/:jobId', async (request, reply) => {
  const { jobId } = request.params as { jobId: string };
  
  const job = await getJob(jobId);
  if (!job) {
    return reply.code(404).send({ error: 'Job not found' });
  }
  
  return {
    job_id: job.job_id,
    status: job.status,
    error_message: job.error_message,
    created_at: job.created_at,
    updated_at: job.updated_at,
  };
});

// Download endpoint
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
  
  if (config.cdnEnabled && job.cdn_url) {
    return {
      job_id: jobId,
      cdn_url: job.cdn_url,
      message: 'CDN URL generated',
    };
  }
  
  try {
    await fs.access(job.output_path);
    const stream = await fs.readFile(job.output_path);
    return reply
      .header('Content-Disposition', `attachment; filename="${path.basename(job.output_path)}"`)
      .type('video/mp4')
      .send(stream);
  } catch {
    return reply.code(404).send({ error: 'Output file not found' });
  }
});

// Retry endpoint
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

// Health check
fastify.get('/health', async () => {
  return { status: 'healthy' };
});

// Start server
const start = async () => {
  try {
    await initDb();
    startWorker();
    await fastify.listen({ port: config.port, host: '0.0.0.0' });
    console.log(`Server listening on port ${config.port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
