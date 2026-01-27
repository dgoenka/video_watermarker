import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

export const backendApi = {
  async uploadVideo(videoFile, nodes, videoDimensions, canvasDimensions, onProgress) {
    const formData = new FormData();
    formData.append('video', videoFile);
    formData.append('data', JSON.stringify({
      nodes,
      video_width: videoDimensions.width,
      video_height: videoDimensions.height,
      video_duration: videoDimensions.duration || 0,
      canvas_width: canvasDimensions.width,
      canvas_height: canvasDimensions.height,
    }));

    const response = await axios.post(`${API_URL}/api/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    });
    return response.data;
  },

  async getStatus(jobId) {
    const response = await axios.get(`${API_URL}/api/status/${jobId}`);
    return response.data;
  },

  async downloadVideo(jobId) {
    const response = await axios.get(`${API_URL}/api/download/${jobId}`, {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'output.mp4');
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  async cancelJob(jobId) {
    const response = await axios.post(`${API_URL}/api/cancel/${jobId}`);
    return response.data;
  },
};