import { FastifyInstance } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { createWriteStream, promises as fs } from 'fs';
import { pipeline } from 'stream/promises';
import path from 'path';
import { spawnSync } from 'child_process';
import { createJob, } from '../db';
import { videoQueue } from '../queue';
import { createJobFolders, saveVideoData } from '../storage';
import sharp from 'sharp';
import { config } from '../config';

export async function uploadRoute(fastify: FastifyInstance) {
  fastify.post('/api/upload', async (request, reply) => {
    try {
      const jobId = uuidv4();
      console.log(`[UPLOAD] Job ${jobId}: Upload started`);
      const { inputVideoDir, inputImagesDir } = await createJobFolders(jobId);
      const jobDir = path.join(config.outputDir, jobId);

      let videoData: any = null;
      let videoFilename: string | null = null;
      // map of uploaded image filename -> saved absolute path
      const savedImages: Record<string, string> = {};
      // metadata for saved images (natural dimensions)
      const savedImageMeta: Record<string, { width?: number; height?: number }> = {};

      // Process all parts
      for await (const part of request.parts()) {
        if (part.type === 'field' && part.fieldname === 'data') {
          const raw = (part as any).value;
          try {
            videoData = JSON.parse(raw);
            console.log(`[UPLOAD] Job ${jobId}: Parsed videoData with duration=${videoData.video_duration} nodes=${(videoData.nodes||[]).length}`);

            // Save embedded images (data URLs) into inputImagesDir and rewrite node image src to local path
            if (Array.isArray(videoData.nodes)) {
              let savedCount = 0;
              for (const node of videoData.nodes) {
                const img = node?.data?.image || node?.data?.src || null;
                if (typeof img === 'string' && img.startsWith('data:')) {
                  // Extract base64 payload
                  const m = img.match(/^data:(.+?);base64,(.+)$/);
                  if (m) {
                    const mime = m[1];
                    const b64 = m[2];
                    const ext = mime.split('/')?.[1] || 'png';
                    const outName = `${node.id || uuidv4()}.${ext}`;
                    const outPath = path.join(inputImagesDir, outName);
                    const buf = Buffer.from(b64, 'base64');
                    await fs.writeFile(outPath, buf);
                    // Replace data.image with local filesystem path so processor can find it
                    node.data.src = outPath;
                    // remove bulky data URL to keep stored JSON small
                    delete node.data.image;
                    savedCount++;
                    console.log(`[UPLOAD] Job ${jobId}: Saved embedded image for node ${node.id} -> ${outPath} (${buf.length} bytes)`);
                    // record mapping and try to probe natural dimensions
                    savedImages[outName] = outPath;
                    try {
                      const meta = await sharp(outPath).metadata();
                      savedImageMeta[outName] = { width: meta.width, height: meta.height };
                      console.log(`[UPLOAD] Job ${jobId}: Probed embedded image ${outName} -> ${meta.width}x${meta.height}`);
                    } catch (err: any) {
                      console.log(`[UPLOAD] Job ${jobId}: Failed to probe embedded image ${outName}: ${err?.message}`);
                    }
                  } else {
                    console.log(`[UPLOAD] Job ${jobId}: Node ${node.id} has image but couldn't parse data URL`);
                  }
                }
              }
              if (savedCount > 0) console.log(`[UPLOAD] Job ${jobId}: Saved ${savedCount} embedded images to ${inputImagesDir}`);
            }
          } catch (e) {
            // Log and persist the truncated/raw payload for debugging
            try {
              const dbgPath = path.join(jobDir, 'input', 'data_failed.json');
              await fs.writeFile(dbgPath, raw);
              const len = raw ? raw.length : 0;
              const head = raw ? raw.slice(0, 2000) : '';
              const tail = raw && raw.length > 2000 ? raw.slice(-2000) : '';
              console.log(`[UPLOAD] Job ${jobId}: Failed to parse videoData JSON: ${String(e)}. Raw length=${len}. Wrote raw to ${dbgPath}`);
              console.log(`[UPLOAD] Job ${jobId}: Raw head(2000): ${head}`);
              if (tail) console.log(`[UPLOAD] Job ${jobId}: Raw tail(2000): ${tail}`);
            } catch (werr) {
              console.log(`[UPLOAD] Job ${jobId}: Failed to write raw failed JSON for debugging: ${String(werr)}`);
            }
            console.log(`[UPLOAD] Job ${jobId}: Failed to parse videoData JSON: ${String(e)}`);
            // Respond with helpful error indicating possible multipart fieldSize truncation
            return reply.code(400).send({ error: 'Failed to parse video data JSON. The "data" multipart field may be truncated (increase multipart.fieldSize). See server logs for raw payload saved under input/data_failed.json.' });
          }
        } else if (part.type === 'file' && part.fieldname === 'images') {
          // handle uploaded image files (multiple allowed)
          const outName = part.filename || `${uuidv4()}.img`;
          const outPath = path.join(inputImagesDir, outName);
          console.log(`[UPLOAD] Job ${jobId}: Received image file: ${outName}`);
          const writeStream = createWriteStream(outPath);
          await pipeline(part.file, writeStream);
          savedImages[outName] = outPath;
          // try to probe natural dimensions
          try {
            const meta = await sharp(outPath).metadata();
            savedImageMeta[outName] = { width: meta.width, height: meta.height };
            console.log(`[UPLOAD] Job ${jobId}: Probed image ${outName} -> ${meta.width}x${meta.height}`);
          } catch (err: any) {
            console.log(`[UPLOAD] Job ${jobId}: Failed to probe uploaded image ${outName}: ${err?.message}`);
          }
         } else if (part.type === 'file' && part.fieldname === 'video') {
           videoFilename = part.filename;
           console.log(`[UPLOAD] Job ${jobId}: Received video file: ${videoFilename}`);
           const videoPath = path.join(inputVideoDir, part.filename);
           const writeStream = createWriteStream(videoPath);
           await pipeline(part.file, writeStream);
         }
       }

      // After processing all parts, if we received uploaded image files, map any node.src references
      if (videoData && Array.isArray(videoData.nodes)) {
        for (const node of videoData.nodes) {
          const src = node?.data?.src;
          if (typeof src === 'string') {
            // if frontend sent filename only, map to savedImages
            if (!src.startsWith('data:') && !path.isAbsolute(src)) {
              const mapped = savedImages[path.basename(src)];
              if (mapped) {
                node.data.src = mapped;
                const meta = savedImageMeta[path.basename(src)];
                if (meta?.width && !node.data.naturalWidth) node.data.naturalWidth = meta.width;
                if (meta?.height && !node.data.naturalHeight) node.data.naturalHeight = meta.height;
                console.log(`[UPLOAD] Job ${jobId}: Mapped node ${node.id} src ${src} -> ${mapped} (natural=${meta?.width}x${meta?.height})`);
              } else {
                // if absolute path already (from embedded data) it was handled earlier; otherwise warn
                if (!path.isAbsolute(src)) {
                  console.log(`[UPLOAD] Job ${jobId}: Node ${node.id} refers to image '${src}' but no uploaded file found`);
                }
              }
            }

            // check for target/display dimensions that backend will need to resample to
            const targetW = node.data.displayWidth || node.data.width || node.data.targetWidth;
            const targetH = node.data.displayHeight || node.data.height || node.data.targetHeight;
            if (!targetW || !targetH) {
              console.log(`[UPLOAD] Job ${jobId}: Node ${node.id} missing target/display width/height — backend cannot know desired resample size`);
            }
          }
        }
      }

      if (!videoFilename) {
        console.log(`[UPLOAD] Job ${jobId}: No video file uploaded`);
        return reply.code(400).send({ error: 'No video file uploaded' });
      }

      if (!videoData) {
        return reply.code(400).send({ error: 'Missing component data' });
      }

      // Save video data (after mapping image filenames -> saved paths)
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
