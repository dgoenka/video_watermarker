import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

export const backendApi = {
  async uploadVideo(videoFile, nodes, videoDimensions, canvasDimensions, onProgress) {
    const formData = new FormData();
    
    // Determine the actual displayed canvas size at the time of submit.
    // This handles cases where the browser was resized after drawing (letterboxing / padding etc.)
    let actualCanvasWidth = canvasDimensions?.width || videoDimensions.width;
    let actualCanvasHeight = canvasDimensions?.height || videoDimensions.height;
    try {
      const wrapper = document.querySelector('.custom-canvas-wrapper');
      if (wrapper) {
        const rect = wrapper.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          actualCanvasWidth = Math.round(rect.width);
          actualCanvasHeight = Math.round(rect.height);
        }
      }
    } catch (e) {
      // fallback to provided canvasDimensions
    }

    console.log('=== FRONTEND DEBUG ===');
    console.log(`DOM Canvas size: ${actualCanvasWidth}x${actualCanvasHeight}`);
    console.log(`Video natural size: ${videoDimensions.width}x${videoDimensions.height}`);
    console.log(`Nodes count: ${nodes.length}`);

    // Collect image files to append as separate multipart parts (field name 'images')
    const imageFiles = [];

    const nodesWithPercentages = nodes.map(node => {
      const posXPercent = (node.position.x / actualCanvasWidth) * 100;
      const posYPercent = (node.position.y / actualCanvasHeight) * 100;
      const widthPercent = (node.width / actualCanvasWidth) * 100;
      const heightPercent = (node.height / actualCanvasHeight) * 100;
      // Font size as percent of canvas width so backend can map it to pixels consistently
      const fontSizePercent = node.data.styles?.fontSize
        ? (parseFloat(node.data.styles.fontSize) / actualCanvasWidth) * 100
        : undefined;

      // If node contains a File object under data.file or data.imageFile, collect it for upload
      const nodeData = { ...node.data };
      if (nodeData.file && nodeData.file instanceof File) {
        imageFiles.push({ file: nodeData.file, filename: nodeData.file.name, nodeId: node.id });
        // Replace the src with just the filename so backend can map it to saved path
        nodeData.src = nodeData.file.name;
        // Include natural dimensions if available on the File object (some image pickers set it)
        if (nodeData.naturalWidth) nodeData.naturalWidth = nodeData.naturalWidth;
        if (nodeData.naturalHeight) nodeData.naturalHeight = nodeData.naturalHeight;
        // Remove the heavy file reference from JSON
        delete nodeData.file;
      } else if (nodeData.imageFile && nodeData.imageFile instanceof File) {
        imageFiles.push({ file: nodeData.imageFile, filename: nodeData.imageFile.name, nodeId: node.id });
        nodeData.src = nodeData.imageFile.name;
        if (nodeData.naturalWidth) nodeData.naturalWidth = nodeData.naturalWidth;
        if (nodeData.naturalHeight) nodeData.naturalHeight = nodeData.naturalHeight;
        delete nodeData.imageFile;
      }

      // If the DOM element for this node has an <img> with natural sizes, include them
      try {
        const nodeWrapper = document.querySelector(`[data-node-id="${node.id}"]`);
        if (nodeWrapper) {
          const imgEl = nodeWrapper.querySelector('img');
          if (imgEl && imgEl.naturalWidth && imgEl.naturalHeight) {
            nodeData.naturalWidth = imgEl.naturalWidth;
            nodeData.naturalHeight = imgEl.naturalHeight;
          }

          // If this is a text node, measure the inner editable element's offset inside the wrapper
          if (node.type === 'text') {
            const textEl = nodeWrapper.querySelector('[contenteditable]');
            if (textEl) {
              const wrapperRect = nodeWrapper.getBoundingClientRect();
              const textRect = textEl.getBoundingClientRect();
              const baselineApprox = (parseFloat(window.getComputedStyle(textEl).fontSize) || 16) * 0.8;
              // offset from top of wrapper to baseline (px)
              const offsetTopPx = Math.max(0, textRect.top - wrapperRect.top);
              const baselineOffsetPx = offsetTopPx + baselineApprox;
              // send as percent of the canvas height so backend can scale
              nodeData.textBaselineOffsetPercent = (baselineOffsetPx / actualCanvasHeight) * 100;
              // Also include measured inner content size if helpful
              nodeData.contentWidth = textRect.width;
              nodeData.contentHeight = textRect.height;
            }
          }
        }
      } catch (e) {
        // ignore
      }

      console.log(`Node ${node.type}: pos=(${node.position.x.toFixed(1)}, ${node.position.y.toFixed(1)}) -> (${posXPercent.toFixed(2)}%, ${posYPercent.toFixed(2)}%)`);
      console.log(`Node ${node.type}: size=(${node.width.toFixed(1)}, ${node.height.toFixed(1)}) -> (${widthPercent.toFixed(2)}%, ${heightPercent.toFixed(2)}%)`);
      if (node.data.styles?.fontSize) {
        console.log(`Node ${node.type}: fontSize=${node.data.styles.fontSize} -> ${fontSizePercent?.toFixed(2)}% (of canvas width)`);
      }

      return {
        ...node,
        position: { x: posXPercent, y: posYPercent },
        width: widthPercent,
        height: heightPercent,
        data: {
          ...nodeData,
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
      // canvas_width/height reflect the DOM canvas size we used to compute percentages
      canvas_width: actualCanvasWidth,
      canvas_height: actualCanvasHeight,
      // Pass the actual DOM/video element size (what user sees in the WYSIWYG canvas)
      video_node_width: actualCanvasWidth,
      video_node_height: actualCanvasHeight,
      use_percentages: true,
    };
    
    console.log('Upload data:', JSON.stringify(uploadData, null, 2).substring(0, 2000));
    
    formData.append('video', videoFile);

    // Append any collected image files as separate 'images' parts
    for (const img of imageFiles) {
      formData.append('images', img.file, img.filename);
    }

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