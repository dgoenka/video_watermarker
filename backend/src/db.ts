import { Pool } from 'pg';
import { config } from './config';

export const pool = new Pool({
  connectionString: config.databaseUrl,
});

export enum JobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface Job {
  job_id: string;
  status: JobStatus;
  output_path: string;
  cdn_url?: string;
  error_message?: string;
  video_data: string;
  created_at: Date;
  updated_at?: Date;
}

export async function initDb() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS jobs (
        job_id VARCHAR(36) PRIMARY KEY,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        output_path VARCHAR(500) NOT NULL,
        cdn_url VARCHAR(500),
        error_message TEXT,
        video_data TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
      CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);
    `);
  } finally {
    client.release();
  }
}

export async function createJob(jobId: string, outputPath: string, videoData: any): Promise<void> {
  await pool.query(
    'INSERT INTO jobs (job_id, status, output_path, video_data) VALUES ($1, $2, $3, $4)',
    [jobId, JobStatus.PENDING, outputPath, JSON.stringify(videoData)]
  );
}

export async function getJob(jobId: string): Promise<Job | null> {
  const result = await pool.query('SELECT * FROM jobs WHERE job_id = $1', [jobId]);
  return result.rows[0] || null;
}

export async function updateJobStatus(
  jobId: string,
  status: JobStatus,
  errorMessage?: string
): Promise<void> {
  await pool.query(
    'UPDATE jobs SET status = $1, error_message = $2, updated_at = CURRENT_TIMESTAMP WHERE job_id = $3',
    [status, errorMessage, jobId]
  );
}

export async function updateJobCompleted(jobId: string, outputPath: string): Promise<void> {
  await pool.query(
    'UPDATE jobs SET status = $1, output_path = $2, updated_at = CURRENT_TIMESTAMP WHERE job_id = $3',
    [JobStatus.COMPLETED, outputPath, jobId]
  );
}
