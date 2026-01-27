import React, { useEffect, useState, useRef } from 'react';
import { backendApi } from './backendApi';
import './ProcessingDialog.css';

export const ProcessingDialog = ({ jobId, isUploading, uploadProgress, onClose }) => {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [downloaded, setDownloaded] = useState(false);
  const pollingRef = useRef(null);

  useEffect(() => {
    if (isUploading || !jobId) return;
    
    let isActive = true;
    
    const pollStatus = async () => {
      if (!isActive) return;
      
      try {
        const statusData = await backendApi.getStatus(jobId);
        if (!isActive) return;
        
        setStatus(statusData);

        if (statusData.status === 'completed') {
          if (!downloaded) {
            setDownloaded(true);
            await backendApi.downloadVideo(jobId);
          }
          return;
        } else if (statusData.status === 'failed') {
          setError(statusData.error_message || 'Processing failed');
          return;
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
        if (isActive) {
          pollStatus();
        }
      } catch (err) {
        if (isActive) {
          setError(err.message);
        }
      }
    };

    pollStatus();

    return () => {
      isActive = false;
    };
  }, [jobId, isUploading, downloaded]);

  const handleRetry = async () => {
    try {
      setError(null);
      setDownloaded(false);
      setStatus({ ...status, status: 'pending' });
      await backendApi.retryJob(jobId);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCancel = async () => {
    try {
      if (jobId) {
        await backendApi.cancelJob(jobId);
      }
      onClose();
    } catch (err) {
      console.error('Cancel failed:', err);
      onClose();
    }
  };

  const handleDownload = async () => {
    await backendApi.downloadVideo(jobId);
  };

  const getStatusText = () => {
    if (isUploading) return 'Uploading...';
    if (!status) return 'Loading...';
    if (status.status === 'pending') return 'Waiting to start...';
    if (status.status === 'processing') return 'Processing video...';
    if (status.status === 'completed') return 'Complete!';
    if (status.status === 'failed') return 'Failed';
    return status.status;
  };

  const getProgress = () => {
    if (isUploading) return uploadProgress;
    if (status?.status === 'completed') return 100;
    if (status?.status === 'processing') return status.progress || 0;
    return 0;
  };

  return (
    <div className="dialog-overlay">
      <div className="dialog-content processing-dialog">
        <div className="dialog-header">Video Processing</div>
        <div className="dialog-body">
          <div className="status-info">
            <p><strong>Status:</strong> {getStatusText()}</p>
            <div className="progress-container">
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${getProgress()}%` }}
                ></div>
              </div>
              <p className="progress-text">{getProgress()}%</p>
            </div>
            {error && <p className="error-text">{error}</p>}
          </div>
        </div>
        <div className="dialog-footer">
          {status?.status === 'completed' && (
            <button className="dialog-button" onClick={handleDownload}>
              Download Again
            </button>
          )}
          {status?.status === 'failed' && (
            <>
              <button className="dialog-button" onClick={handleRetry}>
                Retry
              </button>
              <button className="dialog-button" onClick={handleCancel}>
                Cancel
              </button>
            </>
          )}
          {status?.status !== 'failed' && status?.status !== 'completed' && (
            <button className="dialog-button" onClick={handleCancel}>
              Cancel
            </button>
          )}
          {status?.status === 'completed' && (
            <button className="dialog-button" onClick={onClose}>
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};