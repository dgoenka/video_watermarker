import React, { useEffect, useState, useRef } from 'react';
import { StoreProvider, useStore } from './store';
import { AlertProvider } from './alertContext';

import PipelineUI from './ui';
import { SubmitButton } from './submit';
import { api } from './api';
import { GlobalToolbar } from './GlobalToolbar';
import { backendApi } from './backendApi';
import { ProcessingDialog } from './ProcessingDialog';

const AppContent = () => {
  const { unselectAll, nodes, removeNode, onNodesChange, canvasDimensions } = useStore((state) => ({
    unselectAll: state.unselectAll,
    nodes: state.nodes,
    removeNode: state.removeNode,
    onNodesChange: state.onNodesChange,
    canvasDimensions: state.canvasDimensions,
  }));

  const [videoFile, setVideoFile] = useState(null);
  const [videoDimensions, setVideoDimensions] = useState(null);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [processingJobId, setProcessingJobId] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [originalVideoFile, setOriginalVideoFile] = useState(null);
  const hiddenVideoRef = useRef(null);
  const setStoreVideoDimensions = useStore(state => state.setVideoDimensions);

  useEffect(() => {
    const handleClickOutside = (event) => {
      const isSafeClick =
        event.target.closest('.custom-canvas-wrapper') ||
        event.target.closest('.node-wrapper') ||
        event.target.closest('.line-endpoint-handle') ||
        event.target.closest('.rotation-handle') ||
        event.target.closest('.resizer') ||
        event.target.closest('.global-toolbar') ||
        event.target.closest('.pipeline-toolbar') ||
        event.target.closest('.layers-panel');

      if (!isSafeClick) unselectAll();
    };

    const handleKeyDown = (event) => {
      const isTyping = event.target.isContentEditable || event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA';
      if (isTyping) return;

      const selectedNodes = nodes.filter(n => n.selected);
      
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key) && selectedNodes.length > 0) {
        event.preventDefault();
        const step = event.shiftKey ? 1 : 10;
        const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
        const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
        
        selectedNodes.forEach(node => {
          const newPos = { x: node.position.x + dx, y: node.position.y + dy };
          onNodesChange([{ id: node.id, type: 'position', position: newPos }]);
        });
        return;
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedNodes.length > 0) {
          selectedNodes.forEach(node => removeNode(node.id));
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [unselectAll, nodes, removeNode, onNodesChange]);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (videoFile) {
        URL.revokeObjectURL(videoFile);
      }
      setOriginalVideoFile(file);
      setVideoFile(URL.createObjectURL(file));
      setIsVideoLoaded(false);
    }
  };

  const onLoadedMetadata = () => {
    if (hiddenVideoRef.current) {
      const dims = {
        width: hiddenVideoRef.current.videoWidth,
        height: hiddenVideoRef.current.videoHeight,
      };
      setVideoDimensions(dims);
      setStoreVideoDimensions(dims);
      setIsVideoLoaded(true);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const submitter = event.nativeEvent.submitter;
    if (submitter && !submitter.classList.contains('submit-button')) {
        return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(0);
      
      const videoDuration = hiddenVideoRef.current?.duration || 0;
      const canvas = canvasDimensions || videoDimensions;
      
      const processedNodes = nodes.map(node => {
        if (node.type === 'text') {
          // Find the text content from the DOM element
          const nodeWrapper = document.querySelector(`[data-node-id="${node.id}"]`);
          const textElement = nodeWrapper?.querySelector('[contenteditable]');
          const textContent = textElement?.innerText || node.data?.text || 'Text';
          return {
            ...node,
            data: {
              ...node.data,
              text: textContent
            }
          };
        }
        return node;
      });
      
      const response = await backendApi.uploadVideo(
        originalVideoFile,
        processedNodes,
        { ...videoDimensions, duration: videoDuration },
        canvas,
        (progress) => setUploadProgress(progress)
      );
      
      setIsUploading(false);
      setProcessingJobId(response.job_id);
    } catch (error) {
        console.error('Error submitting video:', error);
        alert('Error: Failed to submit video. Check the console for details.');
        setIsUploading(false);
        setUploadProgress(0);
    }
  };

  if (!videoFile) {
    return (
      <div className="video-picker-container">
        <label htmlFor="video-picker" className="video-picker-label">
          Choose a video file
        </label>
        <input id="video-picker" type="file" accept="video/*" onChange={handleFileChange} />
      </div>
    );
  }

  if (!isVideoLoaded) {
    return (
      <div className="loading-container">
        <video
          ref={hiddenVideoRef}
          src={videoFile}
          onLoadedMetadata={onLoadedMetadata}
          style={{ display: 'none' }}
        />
        <div>Loading video...</div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="app-layout">
      <GlobalToolbar submitButton={<SubmitButton />} />
      <PipelineUI videoFile={videoFile} videoDimensions={videoDimensions} />
      {(isUploading || processingJobId) && (
        <ProcessingDialog
          jobId={processingJobId}
          isUploading={isUploading}
          uploadProgress={uploadProgress}
          onClose={() => {
            setProcessingJobId(null);
            setIsUploading(false);
            setUploadProgress(0);
          }}
        />
      )}
    </form>
  );
};

function App() {
  return (
    <StoreProvider>
      <AlertProvider>
        <AppContent />
      </AlertProvider>
    </StoreProvider>
  );
}

export default App;
