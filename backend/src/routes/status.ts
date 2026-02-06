import { FastifyInstance } from 'fastify';
import { promises as fs } from 'fs';
import * as path from 'path';
import { getJob } from '../db';
import { config } from '../config';
import { getJobTime } from '../progressStore';

export async function statusRoute(fastify: FastifyInstance) {
  // simple in-memory progress cache to ensure monotonic progress per job while the server runs
  const lastProgress: Map<string, number> = new Map();
  const lastSeenTimestamp: Map<string, number> = new Map(); // epoch ms when we last observed a timeSeconds or updated cache
  fastify.get('/api/status/:jobId', async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    
    const job = await getJob(jobId);
    if (!job) {
      return reply.code(404).send({ error: 'Job not found' });
    }
    
    let progress = 0;
    if (job.status === 'processing') {
      // If DB doesn't have a duration, attempt to probe the input video file for duration so we can calculate progress
      let videoDuration = job.video_duration || 0;
      if (!videoDuration || videoDuration <= 0) {
        try {
          const videoPath = path.join(config.outputDir, jobId, 'input', 'video');
          const files = await fs.readdir(videoPath);
          const mp4 = files.find(f => f.endsWith('.mp4'));
          if (mp4) {
            const full = path.join(videoPath, mp4);
            // spawn ffprobe synchronously via child_process to get duration
            // (we import spawnSync lazily to avoid top-level child_process import here)
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { spawnSync } = require('child_process');
            try {
              const res = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', full], { encoding: 'utf-8' });
              if (res.status === 0 && res.stdout && res.stdout.trim()) {
                videoDuration = parseFloat(res.stdout.trim()) || videoDuration;
                console.log(`[STATUS] Job ${jobId}: probed duration via ffprobe -> ${videoDuration}s`);
              } else {
                console.log(`[STATUS] Job ${jobId}: ffprobe failed to probe duration - status=${res.status}`);
              }
            } catch (e) {
              console.log(`[STATUS] Job ${jobId}: ffprobe probe error: ${String(e)}`);
            }
          }
        } catch (e) {
          // ignore if path doesn't exist yet
        }
      }
      // Use videoDuration for calculations below
      // Prefer in-memory live time from ffmpeg stderr if available
      const liveTime = getJobTime(jobId);
      if (typeof liveTime === 'number' && liveTime >= 0) {
        // Use liveTime directly to compute progress
        if (videoDuration && videoDuration > 0) {
          progress = Math.min(Math.round((liveTime / videoDuration) * 100), 99);
          console.log(`[STATUS] Job ${jobId}: using live in-memory time=${liveTime}s -> progress=${progress}`);
          // update caches and return
          lastProgress.set(jobId, progress);
          lastSeenTimestamp.set(jobId, Date.now());
          console.log(`[STATUS] Job ${jobId}: FINAL RESPONSE - status=${job.status}, progress=${progress}`);
          return {
            job_id: job.job_id,
            status: job.status,
            progress,
            error_message: job.error_message,
            created_at: job.created_at,
            updated_at: job.updated_at,
          };
        }
      }

      const progressPath = path.join(config.outputDir, jobId, `${jobId}_progress.txt`);
      console.log(`[STATUS] Job ${jobId}: Checking progress file at ${progressPath}`);
      try {
        const progressData = await fs.readFile(progressPath, 'utf-8');
        console.log(`[STATUS] Job ${jobId}: Progress file content (first 500 chars): ${progressData.substring(0, 500)}`);

        // First look for explicit 'progress=end' which indicates finished
        if (/progress=end/.test(progressData)) {
          console.log(`[STATUS] Job ${jobId}: progress=end found in progress file`);
          progress = 100;
        } else {
          // Extract the last out_time_ms or out_time occurrence (ffmpeg appends repeatedly)
          let timeSeconds: number | null = null;

          // Split by 'progress=' blocks and inspect the last block reported by ffmpeg.
          // ffmpeg writes repeated blocks ending with 'progress=continue' and finally 'progress=end'.
          const blocks = progressData.split(/progress=/);
          const lastBlock = blocks.length ? blocks[blocks.length - 1] : progressData;

          // Try to parse out_time_ms in the last block
          const msMatch = lastBlock.match(/out_time_ms=(\d+)/);
          if (msMatch) {
            const raw = parseInt(msMatch[1]);
            if (raw > 1000000) timeSeconds = raw / 1000000; else timeSeconds = raw / 1000;
            console.log(`[STATUS] Job ${jobId}: parsed out_time_ms from last block=${raw} -> seconds=${timeSeconds}`);
          } else {
            const outMatch = lastBlock.match(/out_time=(\d+):(\d+):(\d+\.\d+)/);
            if (outMatch) {
              const hh = parseInt(outMatch[1]);
              const mm = parseInt(outMatch[2]);
              const ss = parseFloat(outMatch[3]);
              timeSeconds = hh * 3600 + mm * 60 + ss;
              console.log(`[STATUS] Job ${jobId}: parsed out_time from last block=${outMatch[0]} -> seconds=${timeSeconds}`);
            }
          }

          // ignore extremely small probed duration values (likely ffprobe failure)
          if (videoDuration && videoDuration > 0 && videoDuration < 1) {
            console.log(`[STATUS] Job ${jobId}: probed videoDuration=${videoDuration}s looks too small, ignoring for progress calculation`);
            videoDuration = 0;
          }

          if (typeof timeSeconds === 'number' && videoDuration && videoDuration > 0) {
             // guard progress to 0..99 while processing
             const rawProg = Math.min(Math.round((timeSeconds / videoDuration) * 100), 99);
             progress = rawProg;
             console.log(`[STATUS] Job ${jobId}: Calculation - timeSeconds=${timeSeconds}, duration=${videoDuration}, progress=${progress}`);
           } else {
             console.log(`[STATUS] Job ${jobId}: Cannot calculate progress - timeSeconds=${timeSeconds}, duration=${videoDuration}`);
             // if we can't parse a fresh timeSeconds, prefer to return last cached progress (if any)
             const cached = lastProgress.get(jobId);
             if (typeof cached === 'number') {
               // if ffmpeg hasn't updated timeSeconds for a while, slowly nudge progress forward so UI doesn't stay frozen
               const now = Date.now();
               const lastTs = lastSeenTimestamp.get(jobId) || 0;
               const ageSec = (now - lastTs) / 1000;
               if (ageSec > 3 && cached < 99) {
                 // nudge by 1% per 3 seconds of silence (configurable)
                 const nudged = Math.min(99, cached + Math.max(1, Math.floor(ageSec / 3)));
                 console.log(`[STATUS] Job ${jobId}: nodging cached progress from ${cached} -> ${nudged} due to ${ageSec.toFixed(1)}s silence`);
                 progress = nudged;
                 lastSeenTimestamp.set(jobId, now);
               } else {
                 progress = cached;
               }
               console.log(`[STATUS] Job ${jobId}: Using cached progress=${progress}`);
             }
           }
         }
       } catch (error) {
         if ((error as any).code === 'ENOENT') {
           console.log(`[STATUS] Job ${jobId}: Progress file not found at ${progressPath} (ENOENT). Returning progress=0 until ffmpeg creates it.`);
         } else {
           console.log(`[STATUS] Job ${jobId}: Error reading progress file - ${error}`);
         }
       }
    } else if (job.status === 'completed') {
      progress = 100;
    }
    
    // Ensure progress never goes backwards while server is running
    const prev = lastProgress.get(jobId) || 0;
    if (progress < prev) {
      progress = prev;
    }

    // Smooth large jumps: limit how much progress can increase per poll to avoid instant 0->99 jumps
    const maxDelta = 15; // percent per poll
    if (progress - prev > maxDelta) {
      const smoothed = prev + maxDelta;
      console.log(`[STATUS] Job ${jobId}: smoothing progress increase from ${prev} -> ${progress}, using ${smoothed}`);
      progress = smoothed;
    }

    if (progress >= 100 || job.status === 'completed') {
      lastProgress.delete(jobId);
      lastSeenTimestamp.delete(jobId);
    } else {
      lastProgress.set(jobId, progress);
      lastSeenTimestamp.set(jobId, Date.now());
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