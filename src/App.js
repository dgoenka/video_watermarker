import React, { useEffect, useState, useRef } from 'react';
import { StoreProvider, useStore } from './store';
import { AlertProvider } from './alertContext';

import PipelineUI from './ui';
import { SubmitButton } from './submit';
import { api } from './api';
import { GlobalToolbar } from './GlobalToolbar';

const AppContent = () => {
  const { unselectAll, nodes, removeNode } = useStore((state) => ({
    unselectAll: state.unselectAll,
    nodes: state.nodes,
    removeNode: state.removeNode,
  }));

  const [videoFile, setVideoFile] = useState(null);
  const [videoDimensions, setVideoDimensions] = useState(null);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const hiddenVideoRef = useRef(null);
  const setStoreVideoDimensions = useStore(state => state.setVideoDimensions);

  useEffect(() => {
    const handleClickOutside = (event) => {
      const isSafeClick =
        event.target.closest('.custom-canvas-wrapper') ||
        event.target.closest('.node-wrapper') ||
        event.target.closest('.line-endpoint-handle') ||
        event.target.closest('.rotation-handle') ||
        event.target.closest('.global-toolbar') ||
        event.target.closest('.pipeline-toolbar') ||
        event.target.closest('.layers-panel');

      if (!isSafeClick) unselectAll();
    };

    const handleKeyDown = (event) => {
      const isTyping = event.target.isContentEditable || event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA';
      if (isTyping) return;

      if (event.key === 'Delete' || event.key === 'Backspace') {
        const selectedNodes = nodes.filter(n => n.selected);
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
  }, [unselectAll, nodes, removeNode]);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (videoFile) {
        URL.revokeObjectURL(videoFile);
      }
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

    const formData = new FormData(event.target);
    const urlEncodedData = new URLSearchParams(formData).toString();

    try {
      const response = await api.post('/pipelines/parse', urlEncodedData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
      const { num_nodes, num_edges, is_dag } = response.data;
      const message = 
        `Number of Nodes: ${num_nodes}\n` +
        `Number of Edges: ${num_edges}\n` +
        `Is DAG: ${is_dag}`;
      alert(message);
    } catch (error) {
        console.error('Error submitting pipeline:', error);
        alert('Error: Failed to submit pipeline. Check the console for details.');
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
