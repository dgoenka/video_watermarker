from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, Form
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import uuid
import json
import os
import shutil
from pathlib import Path

from database import get_db, init_db
from models import Job, JobStatus
from schemas import (
    UploadRequest, UploadResponse, StatusResponse,
    DownloadResponse, RetryResponse
)
from tasks import process_video_task
from config import settings

app = FastAPI(title="Video Watermarker API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_event():
    init_db()
    os.makedirs(settings.output_dir, exist_ok=True)
    os.makedirs("uploads", exist_ok=True)

@app.post("/api/upload", response_model=UploadResponse)
async def upload_video(
    video: UploadFile = File(...),
    data: str = Form(...),
    db: Session = Depends(get_db)
):
    """Upload video and component data, create processing job"""
    try:
        # Parse component data
        upload_data = json.loads(data)
        
        # Validate video file
        if not video.content_type.startswith('video/'):
            raise HTTPException(status_code=400, detail="Invalid video file")
        
        # Generate job ID
        job_id = str(uuid.uuid4())
        
        # Save uploaded video temporarily
        upload_path = f"uploads/{job_id}_{video.filename}"
        with open(upload_path, "wb") as buffer:
            shutil.copyfileobj(video.file, buffer)
        
        # Determine output path
        output_path = os.path.join(settings.output_dir, f"{job_id}.mp4")
        
        # Create job record
        job = Job(
            job_id=job_id,
            status=JobStatus.PENDING,
            output_path=output_path,
            video_data=json.dumps(upload_data)
        )
        db.add(job)
        db.commit()
        
        # Trigger async processing
        process_video_task.delay(job_id, upload_path)
        
        return UploadResponse(
            job_id=job_id,
            status="pending",
            message="Video uploaded successfully. Processing started."
        )
    
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON data")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/status/{job_id}", response_model=StatusResponse)
async def get_job_status(job_id: str, db: Session = Depends(get_db)):
    """Get processing status for a job"""
    job = db.query(Job).filter(Job.job_id == job_id).first()
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return StatusResponse(
        job_id=job.job_id,
        status=job.status,
        error_message=job.error_message,
        created_at=job.created_at,
        updated_at=job.updated_at
    )

@app.get("/api/download/{job_id}", response_model=DownloadResponse)
async def download_video(job_id: str, db: Session = Depends(get_db)):
    """Download processed video or get CDN URL"""
    job = db.query(Job).filter(Job.job_id == job_id).first()
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if job.status != JobStatus.COMPLETED:
        raise HTTPException(
            status_code=400,
            detail=f"Job not completed. Current status: {job.status.value}"
        )
    
    if settings.cdn_enabled and job.cdn_url:
        return DownloadResponse(
            job_id=job_id,
            cdn_url=job.cdn_url,
            message="CDN URL generated"
        )
    
    if not os.path.exists(job.output_path):
        raise HTTPException(status_code=404, detail="Output file not found")
    
    return FileResponse(
        path=job.output_path,
        media_type='video/mp4',
        filename=f"processed_{job_id}.mp4"
    )

@app.post("/api/retry/{job_id}", response_model=RetryResponse)
async def retry_job(job_id: str, db: Session = Depends(get_db)):
    """Retry a failed job"""
    job = db.query(Job).filter(Job.job_id == job_id).first()
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if job.status != JobStatus.FAILED:
        raise HTTPException(
            status_code=400,
            detail=f"Job is not in failed state. Current status: {job.status.value}"
        )
    
    # Reset job status
    job.status = JobStatus.PENDING
    job.error_message = None
    db.commit()
    
    # Re-trigger processing
    video_data = json.loads(job.video_data)
    upload_path = f"uploads/{job_id}_retry.mp4"
    
    # Note: Original video file might be deleted, need to handle this
    if not os.path.exists(upload_path):
        raise HTTPException(
            status_code=400,
            detail="Original video file not found. Please re-upload."
        )
    
    process_video_task.delay(job_id, upload_path)
    
    return RetryResponse(
        job_id=job_id,
        status="pending",
        message="Job retry initiated"
    )

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
