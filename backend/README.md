# Video Watermarker Backend

Production-ready Node.js/TypeScript/Fastify backend for video watermarking.

## Prerequisites

- Node.js 18+
- PostgreSQL
- Redis
- FFmpeg

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment:
```bash
cp .env.example .env
# Edit .env with your database credentials and settings
```

3. Initialize database:
```bash
npm run db:migrate
```

4. Start Redis:
```bash
redis-server
```

5. Development:
```bash
npm run dev
```

6. Production:
```bash
npm run build
npm start
```

## API Endpoints

### POST /api/upload
Upload video and component data.

**Request:** multipart/form-data
- `file`: Video file
- `data`: JSON string with nodes, video_width, video_height, video_duration

**Response:**
```json
{
  "job_id": "uuid",
  "status": "pending",
  "message": "Video uploaded successfully"
}
```

### GET /api/status/:jobId
Get job status.

**Response:**
```json
{
  "job_id": "uuid",
  "status": "pending|processing|completed|failed",
  "error_message": null,
  "created_at": "2024-01-01T00:00:00Z"
}
```

### GET /api/download/:jobId
Download processed video.

**Response:** File download or CDN URL

### POST /api/retry/:jobId
Retry failed job.

**Response:**
```json
{
  "job_id": "uuid",
  "status": "pending",
  "message": "Job retry initiated"
}
```

## Environment Variables

- `PORT`: Server port (default: 8000)
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `OUTPUT_DIR`: Output directory for processed videos
- `CDN_ENABLED`: Enable CDN (true/false)
- `CDN_BASE_URL`: CDN base URL
- `MAX_UPLOAD_SIZE`: Max upload size in bytes
