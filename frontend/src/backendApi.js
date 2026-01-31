import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

export const backendApi = {
  async uploadVideo(videoFile, nodes, videoDimensions, canvasDimensions, onProgress) {
    const formData = new FormData();
    
    // Convert node positions and dimensions to percentages for resolution-independent rendering
    console.log('=== FRONTEND DEBUG ===');
    console.log(`Canvas: ${canvasDimensions.width}x${canvasDimensions.height}`);
    console.log(`Video: ${videoDimensions.width}x${videoDimensions.height}`);
    console.log(`Nodes count: ${nodes.length}`);
    
    const nodesWithPercentages = nodes.map(node => {
      const posXPercent = (node.position.x / canvasDimensions.width) * 100;
      const posYPercent = (node.position.y / canvasDimensions.height) * 100;
      const widthPercent = (node.width / canvasDimensions.width) * 100;
      const heightPercent = (node.height / canvasDimensions.height) * 100;
      // Font size as vw (percentage of canvas width) for consistent scaling
      // This ensures text scales proportionally across different video resolutions
      const fontSizePercent = node.data.styles?.fontSize
        ? (node.data.styles.fontSize / canvasDimensions.width) * 100
        : undefined;
      
      console.log(`Node ${node.type}: pos=(${node.position.x.toFixed(1)}, ${node.position.y.toFixed(1)}) -> (${posXPercent.toFixed(2)}%, ${posYPercent.toFixed(2)}%)`);
      console.log(`Node ${node.type}: size=(${node.width.toFixed(1)}, ${node.height.toFixed(1)}) -> (${widthPercent.toFixed(2)}%, ${heightPercent.toFixed(2)}%)`);
      if (node.data.styles?.fontSize) {
        console.log(`Node ${node.type}: fontSize=${node.data.styles.fontSize} -> ${fontSizePercent?.toFixed(2)}%`);
      }
      
      return {
        ...node,
        position: { x: posXPercent, y: posYPercent },
        width: widthPercent,
        height: heightPercent,
        data: {
          ...node.data,
          styles: node.data.styles ? {
            ...node.data.styles,
            fontSize: fontSizePercent ? `${fontSizePercent}%` : undefined,
          } : {},
        }
      };
    });
    
    const uploadData = {
      nodes: nodesWithPercentages,
      video_width: videoDimensions.width,
      video_height: videoDimensions.height,
      video_duration: videoDimensions.duration || 0,
      canvas_width: canvasDimensions.width,
      canvas_height: canvasDimensions.height,
      // Pass the actual DOM/video element size (what user sees in the WYSIWYG canvas)
      video_node_width: canvasDimensions.width,
      video_node_height: canvasDimensions.height,
      use_percentages: true,
    };
    
    console.log('Upload data:', JSON.stringify(uploadData, null, 2).substring(0, 2000));
    
    formData.append('video', videoFile);
    formData.append('data', JSON.stringify(uploadData));

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