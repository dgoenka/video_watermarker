from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    database_url: str
    output_dir: str
    cdn_enabled: bool = False
    cdn_base_url: Optional[str] = None
    max_upload_size: int = 524288000  # 500MB
    
    class Config:
        env_file = ".env"
        case_sensitive = False

settings = Settings()
