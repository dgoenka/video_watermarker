from celery import Celery
from sqlalchemy.orm import Session
from database import SessionLocal
from models import Job, JobStatus
from video_processor import VideoProcessor
import json
import os

celery_app = Celery('video_processor', broker='redis://localhost:6379/0')

@celery_app.task(bind=True)
def process_video_task(self, job_id: str, video_path: str):
    """Background task to process video with overlays"""
    db: Session = SessionLocal()
    
    try:
        # Get job from database
        job = db.query(Job).filter(Job.job_id == job_id).first()
        if not job:
            return {"success": False, "error": "Job not found"}
        
        # Update status to processing
        job.status = JobStatus.PROCESSING
        db.commit()
        
        # Parse video data
        video_data = json.loads(job.video_data)
        components = video_data.get('nodes', [])
        video_width = video_data.get('video_width', 1920)
        video_height = video_data.get('video_height', 1080)
        video_duration = video_data.get('video_duration', 0)
        
        # Process video
        processor = VideoProcessor(
            job_id=job_id,
            video_path=video_path,
            components=components,
            video_width=video_width,
            video_height=video_height,
            video_duration=video_duration
        )
        
        success, result = processor.process()
        
        if success:
            job.status = JobStatus.COMPLETED
            job.output_path = result
        else:
            job.status = JobStatus.FAILED
            job.error_message = result
        
        db.commit()
        
        # Clean up uploaded video file
        if os.path.exists(video_path):
            os.remove(video_path)
        
        return {"success": success, "result": result}
    
    except Exception as e:
        job.status = JobStatus.FAILED
        job.error_message = str(e)
        db.commit()
        return {"success": False, "error": str(e)}
    
    finally:
        db.close()
