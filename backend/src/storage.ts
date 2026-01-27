import { promises as fs } from 'fs';
import path from 'path';
import { config } from './config';

const JOBS_DIR = config.outputDir;

export async function createJobFolders(jobId: string): Promise<{
  inputVideoDir: string;
  inputImagesDir: string;
  outputDir: string;
}> {
  const jobDir = path.join(JOBS_DIR, jobId);
  const inputDir = path.join(jobDir, 'input');
  const inputVideoDir = path.join(inputDir, 'video');
  const inputImagesDir = path.join(inputDir, 'images');
  const outputDir = path.join(jobDir, 'output');

  await fs.mkdir(inputVideoDir, { recursive: true });
  await fs.mkdir(inputImagesDir, { recursive: true });
  await fs.mkdir(outputDir, { recursive: true });

  return { inputVideoDir, inputImagesDir, outputDir };
}

export async function saveVideoData(jobId: string, videoData: any): Promise<void> {
  const jobDir = path.join(JOBS_DIR, jobId);
  await fs.writeFile(
    path.join(jobDir, 'input', 'data.json'),
    JSON.stringify(videoData, null, 2)
  );
}

export async function getVideoData(jobId: string): Promise<any> {
  const dataPath = path.join(JOBS_DIR, jobId, 'input', 'data.json');
  const data = await fs.readFile(dataPath, 'utf-8');
  return JSON.parse(data);
}

export async function getVideoPath(jobId: string): Promise<string> {
  const videoDir = path.join(JOBS_DIR, jobId, 'input', 'video');
  const files = await fs.readdir(videoDir);
  if (files.length === 0) throw new Error('No video file found');
  return path.join(videoDir, files[0]);
}

export async function getOutputPath(jobId: string): Promise<string> {
  return path.join(JOBS_DIR, jobId, 'output', 'output.mp4');
}

export async function saveErrorLog(jobId: string, error: string): Promise<void> {
  const errorPath = path.join(JOBS_DIR, jobId, 'output', 'error.log');
  await fs.writeFile(errorPath, error);
}

export async function cleanupJob(jobId: string): Promise<void> {
  const jobDir = path.join(JOBS_DIR, jobId);
  await fs.rm(jobDir, { recursive: true, force: true });
}