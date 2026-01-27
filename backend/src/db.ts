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
  video_duration?: number;
  error_message?: string;
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
        video_duration FLOAT,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
      CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);
    `);
    
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='jobs' AND column_name='video_duration') THEN
          ALTER TABLE jobs ADD COLUMN video_duration FLOAT;
        END IF;
      END $$;
    `);
  } finally {
    client.release();
  }
}

export async function createJob(jobId: string, videoDuration?: number): Promise<void> {
  await pool.query(
    'INSERT INTO jobs (job_id, status, video_duration) VALUES ($1, $2, $3)',
    [jobId, JobStatus.PENDING, videoDuration]
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

export async function updateJobCompleted(jobId: string): Promise<void> {
  await pool.query(
    'UPDATE jobs SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE job_id = $2',
    [JobStatus.COMPLETED, jobId]
  );
}
