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

      // We are not using ReactFlow anymore:
      const nodeElement = handleRef.current?.closest('.node-wrapper');
      if (!nodeElement) return;

      const rect = nodeElement.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const dx = e.clientX - centerX;
      const dy = e.clientY - centerY;

      let angle = Math.atan2(dy, dx) * (180 / Math.PI);
      angle += 90;

      if (e.shiftKey) {
        angle = Math.round(angle / 45) * 45;
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
        e.stopPropagation(); // Prevent node drag
        setIsRotating(true);
      }}
      style={{
        position: 'absolute',
        top: -25, // Position above the node
        left: '50%',
        transform: 'translateX(-50%)',
        width: 10,
        height: 10,
        background: '#fff',
        border: '1px solid #1976d2',
        borderRadius: '50%',
        cursor: 'grab',
        zIndex: 1002,
      }}
    >
        {/* Connecting line */}
        <div style={{
            position: 'absolute',
            top: 10,
            left: '50%',
            width: 1,
            height: 15,
            background: '#1976d2',
            transform: 'translateX(-50%)',
        }} />
    </div>
  );
};
