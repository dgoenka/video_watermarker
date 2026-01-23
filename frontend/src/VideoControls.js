// VideoControls.js
import React, { useState, useEffect } from 'react';
import { useStore } from './store';
import './VideoControls.css';

const formatTime = (time) => {
  if (isNaN(time)) return '00:00';
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

export const VideoControls = ({ videoRef }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [frameRate, setFrameRate] = useState(30); // Default frame rate
  const { currentTime, setCurrentTime, unselectAll } = useStore(state => ({
    currentTime: state.currentTime,
    setCurrentTime: state.setCurrentTime,
    unselectAll: state.unselectAll,
  }));

  const handlePlayPause = (e) => {
    e.preventDefault();
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
        // Unselect all nodes when playback starts
        unselectAll();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeek = (e, amount) => {
    e.preventDefault();
    if (videoRef.current) {
      videoRef.current.currentTime += amount;
    }
  };

  const handleFrameStep = (e, direction) => {
    e.preventDefault();
    if (videoRef.current) {
      const frameDuration = 1 / frameRate;
      const newTime = videoRef.current.currentTime + (direction * frameDuration);
      videoRef.current.currentTime = Math.max(0, Math.min(duration, newTime));
    }
  };

  const handleProgressChange = (e) => {
    if (videoRef.current) {
      const newTime = parseFloat(e.target.value);
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const estimateFrameRate = () => {
      if (video.getVideoPlaybackQuality) {
        const videoTrack = video.srcObject?.getVideoTracks()[0];
        if (videoTrack?.getSettings) {
          const { frameRate } = videoTrack.getSettings();
          if (frameRate) {
            setFrameRate(frameRate);
            return;
          }
        }
      }
      // Fallback if API is not supported
      setFrameRate(30);
    };

    const updateProgress = () => setCurrentTime(video.currentTime);
    const updateDuration = () => {
      setDuration(video.duration);
      estimateFrameRate();
    };
    const onPlay = () => {
        setIsPlaying(true);
        unselectAll();
    };
    const onPause = () => setIsPlaying(false);

    video.addEventListener('timeupdate', updateProgress);
    video.addEventListener('loadedmetadata', updateDuration);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('ended', onPause);

    return () => {
      video.removeEventListener('timeupdate', updateProgress);
      video.removeEventListener('loadedmetadata', updateDuration);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('ended', onPause);
    };
  }, [videoRef, setCurrentTime, unselectAll]);

  return (
    <div className="video-controls-container">
      <div className="progress-bar-container">
        <input
          type="range"
          min="0"
          max={duration}
          step="0.01"
          value={currentTime}
          onChange={handleProgressChange}
          className="progress-bar"
        />
      </div>
      <div className="controls-row">
        <div className="time-display">{formatTime(currentTime)} / {formatTime(duration)}</div>
        <div className="main-controls">
            <button onClick={(e) => handleSeek(e, -30)}>« 30s</button>
            <button onClick={(e) => handleSeek(e, -10)}>« 10s</button>
            <button onClick={(e) => handleSeek(e, -5)}>« 5s</button>
            <button onClick={(e) => handleFrameStep(e, -1)}>‹</button>
            <button onClick={handlePlayPause} className="play-pause-btn">{isPlaying ? '❚❚' : '▶'}</button>
            <button onClick={(e) => handleFrameStep(e, 1)}>›</button>
            <button onClick={(e) => handleSeek(e, 5)}>5s »</button>
            <button onClick={(e) => handleSeek(e, 10)}>10s »</button>
            <button onClick={(e) => handleSeek(e, 30)}>30s »</button>
        </div>
        <div className="placeholder-div" />
      </div>
    </div>
  );
};
