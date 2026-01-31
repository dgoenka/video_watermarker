const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// This test script is intentionally placed inside backend/tests so it can be removed easily.
// It reads a filter file (tests/filter.txt if present, otherwise ../filter.txt) and runs ffmpeg
// against an input video placed under the job output folder (configured via OUTPUT_DIR env var)

const OUTPUT_DIR = process.env.OUTPUT_DIR || require('../dist/config').config.outputDir || '/tmp/outputs';

const filterPath = fs.existsSync(path.join(__dirname, 'filter.txt')) ? path.join(__dirname, 'filter.txt') : path.join(__dirname, '..', 'filter.txt');
if (!fs.existsSync(filterPath)) {
  console.error('No filter file found at', filterPath);
  process.exit(1);
}
const filter = fs.readFileSync(filterPath, 'utf8');

// The test expects an input video placed in OUTPUT_DIR/<jobId>/input/video/<file>.mp4
// Provide JOB_ID env var to locate a test job folder. Otherwise it will search first job found.
const JOB_ID = process.env.JOB_ID;

function findInputVideo() {
  if (JOB_ID) {
    const candidateDir = path.join(OUTPUT_DIR, JOB_ID, 'input', 'video');
    if (fs.existsSync(candidateDir)) {
      const files = fs.readdirSync(candidateDir).filter(f => f.endsWith('.mp4'));
      if (files.length) return path.join(candidateDir, files[0]);
    }
    return null;
  }

  // find any job with an mp4 in input/video
  const jobs = fs.readdirSync(OUTPUT_DIR).sort().reverse();
  for (const j of jobs) {
    const candidateDir = path.join(OUTPUT_DIR, j, 'input', 'video');
    if (fs.existsSync(candidateDir)) {
      const files = fs.readdirSync(candidateDir).filter(f => f.endsWith('.mp4'));
      if (files.length) return path.join(candidateDir, files[0]);
    }
  }
  return null;
}

const input = findInputVideo();
if (!input) {
  console.error('No input video found under', OUTPUT_DIR);
  process.exit(1);
}

const outDir = path.join(OUTPUT_DIR, JOB_ID || 'test-run');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const output = path.join(outDir, 'test_output.mp4');

console.log('Running ffmpeg filter (first 300 chars):', filter.slice(0,300));
console.log('Input:', input);
console.log('Output:', output);

const args = ['-i', input, '-vf', filter, '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-c:a', 'copy', '-y', output];

const ffmpeg = spawn('ffmpeg', args);
ffmpeg.stdout.on('data', (d) => process.stdout.write('[ffmpeg stdout] ' + d.toString()));
ffmpeg.stderr.on('data', (d) => process.stderr.write('[ffmpeg stderr] ' + d.toString()));
ffmpeg.on('close', (code) => {
  console.log('ffmpeg exited', code);
  if (code === 0) console.log('Wrote:', output);
});
