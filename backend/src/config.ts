import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '8000'),
  databaseUrl: process.env.DATABASE_URL!,
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  outputDir: process.env.OUTPUT_DIR || '/tmp/outputs',
  cdnEnabled: process.env.CDN_ENABLED === 'true',
  cdnBaseUrl: process.env.CDN_BASE_URL || '',
  maxUploadSize: parseInt(process.env.MAX_UPLOAD_SIZE || '524288000'),
};
