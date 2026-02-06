const path = require('path');
const fs = require('fs');
const { VideoProcessor } = require('../dist/processor');
const config = require('../dist/config').config;

async function runJob(jobId) {
  try {
    const jobDir = path.join(config.outputDir, jobId);
    const dataPath = path.join(jobDir, 'input', 'data.json');
    const videoDir = path.join(jobDir, 'input', 'video');
    const outDir = path.join(jobDir, 'output');
    if (!fs.existsSync(dataPath)) {
      console.error('data.json not found for job', jobId, dataPath);
      process.exit(1);
    }
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

    // find first mp4 in videoDir
    const vids = fs.existsSync(videoDir) ? fs.readdirSync(videoDir).filter(f => f.endsWith('.mp4')) : [];
    if (vids.length === 0) {
      console.error('No input video found in', videoDir);
      process.exit(1);
    }
    const inputVideo = path.join(videoDir, vids[0]);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const outputVideo = path.join(outDir, 'output.mp4');

    console.log('Running VideoProcessor for job', jobId);
    console.log('Input video:', inputVideo);
    console.log('Output video:', outputVideo);

    const proc = new VideoProcessor(jobId, inputVideo, outputVideo, data);
    const res = await proc.process();
    console.log('Processor result:', res);
  } catch (err) {
    console.error('runJob error:', err);
    process.exit(1);
  }
}

const jobId = process.argv[2];
if (!jobId) {
  console.error('Usage: node dev-tools/run_job.js <jobId>');
  process.exit(1);
}

runJob(jobId).catch(e => { console.error(e); process.exit(1); });
