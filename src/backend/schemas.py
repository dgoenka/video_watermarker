from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from models import JobStatus

class ComponentData(BaseModel):
    id: str
    type: str
    position: Dict[str, float]
    width: float
    height: float
    data: Dict[str, Any]
    selected: bool = False

class UploadRequest(BaseModel):
    nodes: List[ComponentData]
    video_duration: float
    video_width: int
    video_height: int

class UploadResponse(BaseModel):
    job_id: str
    status: str
    message: str

class StatusResponse(BaseModel):
    job_id: str
    status: JobStatus
    progress: Optional[int] = None
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

class DownloadResponse(BaseModel):
    job_id: str
    download_url: Optional[str] = None
    cdn_url: Optional[str] = None
    message: str

class RetryResponse(BaseModel):
    job_id: str
    status: str
    message: str
