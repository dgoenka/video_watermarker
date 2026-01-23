import React, { useEffect, useState } from 'react';
import { backendApi } from './backendApi';
import './ProcessingDialog.css';

export const ProcessingDialog = ({ jobId, onClose }) => {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const pollStatus = async () => {
      try {
        const statusData = await backendApi.getStatus(jobId);
        setStatus(statusData);

        if (statusData.status === 'completed') {
          // Auto-download after completion
          setTimeout(() => {
            backendApi.downloadVideo(jobId);
          }, 1000);
        } else if (statusData.status === 'failed') {
          setError(statusData.error_message || 'Processing failed');
        }
      } catch (err) {
        setError(err.message);
      }
    };

    pollStatus();
    const interval = setInterval(pollStatus, 2000);

    return () => clearInterval(interval);
  }, [jobId]);

  const handleRetry = async () => {
    try {
      setError(null);
      await backendApi.retryJob(jobId);
      setStatus({ ...status, status: 'pending' });
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDownload = () => {
    backendApi.downloadVideo(jobId);
  };

  return (
    <div className="dialog-overlay">
      <div className="dialog-content processing-dialog">
        <div className="dialog-header">Video Processing</div>
        <div className="dialog-body">
          <div className="status-info">
            <p><strong>Job ID:</strong> {jobId}</p>
            <p><strong>Status:</strong> {status?.status || 'Loading...'}</p>
            
            {status?.status === 'pending' && (
              <div className="status-message">
                <div className="spinner"></div>
                <p>Waiting to start...</p>
              </div>
            )}
            
            {status?.status === 'processing' && (
              <div className="status-message">
                <div className="spinner"></div>
                <p>Processing video with overlays...</p>
              </div>
            )}
            
            {status?.status === 'completed' && (
              <div className="status-message success">
                <p>✓ Processing completed!</p>
                <p>Download will start automatically...</p>
              </div>
            )}
            
            {status?.status === 'failed' && (
              <div className="status-message error">
                <p>✗ Processing failed</p>
                {error && <p className="error-text">{error}</p>}
              </div>
            )}
          </div>
        </div>
        <div className="dialog-footer">
          {status?.status === 'completed' && (
            <button className="dialog-button" onClick={handleDownload}>
              Download Again
            </button>
          )}
          {status?.status === 'failed' && (
            <button className="dialog-button" onClick={handleRetry}>
              Retry
            </button>
          )}
          <button className="dialog-button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};