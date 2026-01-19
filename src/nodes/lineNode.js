// lineNode.js
import React, { useEffect, useState } from 'react';
import { useStore } from '../store';
import { withNodeFeatures } from './withNodeFeatures';

const LineNodeComponent = ({ id, data = {}, styles = {}, isVisible, selected }) => {
  const { updateNodeField, onNodesChange } = useStore((state) => ({
    updateNodeField: state.updateNodeField,
    onNodesChange: state.onNodesChange,
  }));

  const [dragEndpoint, setDragEndpoint] = useState(null); // 'start' | 'end' | null

  const startPoint = data.startPoint || { x: 0, y: 0 };
  const endPoint = data.endPoint || { x: 100, y: 0 };

  // Node bbox is derived from endpoints
  const minX = Math.min(startPoint.x, endPoint.x);
  const minY = Math.min(startPoint.y, endPoint.y);
  const x1 = startPoint.x - minX;
  const y1 = startPoint.y - minY;
  const x2 = endPoint.x - minX;
  const y2 = endPoint.y - minY;

  const markerStartId = `marker-start-${id}`;
  const markerEndId = `marker-end-${id}`;

  const dash =
    styles.borderStyle === 'dashed'
      ? '5,5'
      : styles.borderStyle === 'dotted'
        ? '2,2'
        : undefined;

  const getCanvasPointFromEvent = (e) => {
    const canvas = document.querySelector('.custom-canvas-wrapper');
    const bounds = canvas?.getBoundingClientRect();
    if (!bounds) return { x: e.clientX, y: e.clientY };
    return { x: e.clientX - bounds.left, y: e.clientY - bounds.top };
  };

  useEffect(() => {
    const onMove = (e) => {
      if (!dragEndpoint) return;

      const mousePos = getCanvasPointFromEvent(e);

      const newStart = dragEndpoint === 'start' ? mousePos : startPoint;
      const newEnd = dragEndpoint === 'end' ? mousePos : endPoint;

      const newMinX = Math.min(newStart.x, newEnd.x);
      const newMinY = Math.min(newStart.y, newEnd.y);
      const newWidth = Math.abs(newEnd.x - newStart.x) || 1;
      const newHeight = Math.abs(newEnd.y - newStart.y) || 1;

      // Update bbox
      onNodesChange([
        { type: 'position', id, position: { x: newMinX, y: newMinY } },
        { type: 'dimensions', id, dimensions: { width: newWidth, height: newHeight } },
      ]);

      // Update geometry
      updateNodeField(id, 'startPoint', newStart);
      updateNodeField(id, 'endPoint', newEnd);
    };

    const onUp = () => setDragEndpoint(null);

    if (dragEndpoint) {
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp, { once: true });
    }

    return () => {
      document.removeEventListener('mousemove', onMove);
    };
  }, [dragEndpoint, id, startPoint, endPoint, onNodesChange, updateNodeField]);

  return (
    <div
      className="node-body custom-drag-handle"
      style={{
        width: '100%',
        height: '100%',
        opacity: isVisible ? (styles.opacity ?? 1) : 0,
        pointerEvents: isVisible ? 'auto' : 'none',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <svg width="100%" height="100%" style={{ overflow: 'visible' }}>
        <defs>
          <marker id={markerStartId} markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto-start-reverse">
            {styles.arrowStart === 'arrow' && <path d="M0,5 L10,0 L10,10 Z" fill={styles.borderColor || '#000'} />}
            {styles.arrowStart === 'circle' && <circle cx="5" cy="5" r="3" fill={styles.borderColor || '#000'} />}
          </marker>
          <marker id={markerEndId} markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto">
            {styles.arrowEnd === 'arrow' && <path d="M0,0 L10,5 L0,10 Z" fill={styles.borderColor || '#000'} />}
            {styles.arrowEnd === 'circle' && <circle cx="5" cy="5" r="3" fill={styles.borderColor || '#000'} />}
          </marker>
        </defs>

        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={styles.borderColor || '#000'}
          strokeWidth={styles.borderWidth || 2}
          strokeDasharray={dash}
          markerStart={styles.arrowStart && styles.arrowStart !== 'none' ? `url(#${markerStartId})` : undefined}
          markerEnd={styles.arrowEnd && styles.arrowEnd !== 'none' ? `url(#${markerEndId})` : undefined}
        />
      </svg>

      {/* Two endpoint handles only (PowerPoint-style) */}
      {selected && (
        <>
          <div
            className="line-endpoint-handle"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragEndpoint('start');
            }}
            style={{
              position: 'absolute',
              left: x1,
              top: y1,
              transform: 'translate(-50%, -50%)',
              width: 10,
              height: 10,
              background: '#fff',
              border: '1px solid #1976d2',
              borderRadius: '50%',
              cursor: 'crosshair',
              zIndex: 1002,
              pointerEvents: 'auto',
            }}
          />
          <div
            className="line-endpoint-handle"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragEndpoint('end');
            }}
            style={{
              position: 'absolute',
              left: x2,
              top: y2,
              transform:   'translate(-50%, -50%)',
              width: 10,
              height: 10,
              background: '#fff',
              border: '1px solid #1976d2',
              borderRadius: '50%',
              cursor: 'crosshair',
              zIndex: 1002,
              pointerEvents: 'auto',
            }}
          />
        </>
      )}
    </div>
  );
};

const onMouseDown = (e) => {
  if (e.target.closest('.line-endpoint-handle')) return;
  // ... existing code ...
};

export const LineNode = withNodeFeatures(LineNodeComponent);
