import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

export interface UploadResponse {
  job_id: string;
  status: string;
  message: string;
}

export interface StatusResponse {
  job_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error_message?: string;
  created_at: string;
  updated_at?: string;
}

export interface DownloadResponse {
  job_id: string;
  cdn_url?: string;
  message: string;
}

export const backendApi = {
  async uploadVideo(videoFile: File, nodes: any[], videoDimensions: any): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('video', videoFile);
    formData.append('data', JSON.stringify({
      nodes,
      video_width: videoDimensions.width,
      video_height: videoDimensions.height,
      video_duration: 0, // Will be set from video element
    }));

    const response = await axios.post(`${API_URL}/api/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  async getStatus(jobId: string): Promise<StatusResponse> {
    const response = await axios.get(`${API_URL}/api/status/${jobId}`);
    return response.data;
  },

  async downloadVideo(jobId: string): Promise<void> {
    window.open(`${API_URL}/api/download/${jobId}`, '_blank');
  },

  async retryJob(jobId: string): Promise<UploadResponse> {
    const response = await axios.post(`${API_URL}/api/retry/${jobId}`);
    return response.data;
  },
};
