// RotationHandle.js
import React, { useEffect, useState, useRef } from 'react';
import { useStore } from '../store';

export const RotationHandle = ({ id, rotation = 0 }) => {
  const updateNodeField = useStore(state => state.updateNodeField);
  const [isRotating, setIsRotating] = useState(false);
  const handleRef = useRef(null);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isRotating) return;

      const nodeElement = handleRef.current?.closest('.node-wrapper');
      if (!nodeElement) return;

      const canvas = document.querySelector('.custom-canvas-wrapper');
      const canvasBounds = canvas?.getBoundingClientRect();
      const nodeBounds = nodeElement.getBoundingClientRect();
      
      if (!canvasBounds || !nodeBounds) return;

      // Calculate center relative to canvas
      const centerX = nodeBounds.left - canvasBounds.left + nodeBounds.width / 2;
      const centerY = nodeBounds.top - canvasBounds.top + nodeBounds.height / 2;
      
      // Mouse position relative to canvas
      const mouseX = e.clientX - canvasBounds.left;
      const mouseY = e.clientY - canvasBounds.top;

      const dx = mouseX - centerX;
      const dy = mouseY - centerY;

      let angle = Math.atan2(dy, dx) * (180 / Math.PI);
      angle += 90; // Adjust so 0 degrees is pointing up

      if (e.shiftKey) {
        angle = Math.round(angle / 15) * 15; // Snap to 15-degree increments
      }

      updateNodeField(id, 'rotation', angle);
    };

    const handleMouseUp = () => {
      setIsRotating(false);
    };

    if (isRotating) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isRotating, id, updateNodeField]);

  return (
    <div
      ref={handleRef}
      className="rotation-handle"
      onMouseDown={(e) => {
        e.stopPropagation();
        setIsRotating(true);
      }}
    />
  );
};
