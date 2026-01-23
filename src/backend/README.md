# Video Watermarker Backend

Production-ready FastAPI backend for video watermarking with component overlays.

## Prerequisites

- Python 3.9+
- PostgreSQL
- Redis
- FFmpeg

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Configure environment:
```bash
cp .env.example .env
# Edit .env with your database credentials and settings
```

3. Initialize database:
```bash
python -c "from database import init_db; init_db()"
```

4. Start Redis (for Celery):
```bash
redis-server
```

5. Start Celery worker:
```bash
celery -A tasks worker --loglevel=info
```

6. Start FastAPI server:
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## API Endpoints

### POST /api/upload
Upload video and component data for processing.

**Request:**
- `video`: Video file (multipart/form-data)
- `data`: JSON string containing:
  - `nodes`: Array of component objects
  - `video_width`: Video width
  - `video_height`: Video height
  - `video_duration`: Video duration in seconds

**Response:**
```json
{
  "job_id": "uuid",
  "status": "pending",
  "message": "Video uploaded successfully"
}
```

### GET /api/status/{job_id}
Get processing status for a job.

**Response:**
```json
{
  "job_id": "uuid",
  "status": "pending|processing|completed|failed",
  "error_message": null,
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

### GET /api/download/{job_id}
Download processed video or get CDN URL.

**Response:**
- File download (if CDN disabled)
- JSON with CDN URL (if CDN enabled)

### POST /api/retry/{job_id}
Retry a failed job.

**Response:**
```json
{
  "job_id": "uuid",
  "status": "pending",
  "message": "Job retry initiated"
}
```

## Production Deployment

1. Use gunicorn with uvicorn workers:
```bash
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

2. Set up supervisor/systemd for process management

3. Configure nginx as reverse proxy

4. Enable CDN for file delivery (set CDN_ENABLED=true in .env)

## Environment Variables

- `DATABASE_URL`: PostgreSQL connection string
- `OUTPUT_DIR`: Directory for processed videos
- `CDN_ENABLED`: Enable CDN delivery (true/false)
- `CDN_BASE_URL`: CDN base URL
- `MAX_UPLOAD_SIZE`: Maximum upload size in bytes
