// NodeWrapper.js
import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store';
import './nodewrapper.css';

const Resizer = ({ onResizeStart }) => (
  <>
    <div onMouseDown={(e) => onResizeStart(e, 'top-left')} className="resizer top-left" />
    <div onMouseDown={(e) => onResizeStart(e, 'top-right')} className="resizer top-right" />
    <div onMouseDown={(e) => onResizeStart(e, 'bottom-left')} className="resizer bottom-left" />
    <div onMouseDown={(e) => onResizeStart(e, 'bottom-right')} className="resizer bottom-right" />
  </>
);

export const NodeWrapper = ({ id, type, children, position, width, height, selected }) => {
  const { onNodesChange, selectNode, updateNodeField } = useStore(state => ({
    onNodesChange: state.onNodesChange,
    selectNode: state.selectNode,
    updateNodeField: state.updateNodeField,
  }));

  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(null);

  const dragOffset = useRef({ x: 0, y: 0 });

  // For line dragging: keep original geometry so we can apply delta cleanly
  const dragStartRef = useRef({
    position: { x: 0, y: 0 },
    startPoint: null,
    endPoint: null,
  });

  const resizeStart = useRef({ x: 0, y: 0, width: 0, height: 0, position: { x: 0, y: 0 } });

  const onMouseDown = (e) => {
    // Prevent starting drag if a resize handle was clicked
    if (e.target.classList.contains('resizer')) return;

    e.stopPropagation();
    setIsDragging(true);

    const canvas = document.querySelector('.custom-canvas-wrapper');
    const bounds = canvas?.getBoundingClientRect();
    const localX = bounds ? (e.clientX - bounds.left) : e.clientX;
    const localY = bounds ? (e.clientY - bounds.top) : e.clientY;

    dragOffset.current = {
      x: localX - position.x,
      y: localY - position.y,
    };

    // capture original state for line move
    dragStartRef.current.position = { ...position };

    if (type === 'line') {
      // note: these fields live under node.data
      // we read them from DOM store indirectly via updateNodeField during drag (below)
      // so we’ll rely on current node data being correct at drag start:
      const node = useStore.getState().nodes.find(n => n.id === id);
      dragStartRef.current.startPoint = node?.data?.startPoint ? { ...node.data.startPoint } : null;
      dragStartRef.current.endPoint = node?.data?.endPoint ? { ...node.data.endPoint } : null;
    } else {
      dragStartRef.current.startPoint = null;
      dragStartRef.current.endPoint = null;
    }

    selectNode(id);
  };

  const onResizeStart = (e, direction) => {
    // Lines should NOT box-resize
    if (type === 'line') return;

    e.stopPropagation();
    setIsResizing(direction);
    resizeStart.current = {
      x: e.clientX,
      y: e.clientY,
      width,
      height,
      position,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      const canvas = document.querySelector('.custom-canvas-wrapper');
      const bounds = canvas?.getBoundingClientRect();
      const localX = bounds ? (e.clientX - bounds.left) : e.clientX;
      const localY = bounds ? (e.clientY - bounds.top) : e.clientY;

      if (isDragging) {
        const newPos = {
          x: localX - dragOffset.current.x,
          y: localY - dragOffset.current.y,
        };

        if (type === 'line' && dragStartRef.current.startPoint && dragStartRef.current.endPoint) {
          const dx = newPos.x - dragStartRef.current.position.x;
          const dy = newPos.y - dragStartRef.current.position.y;

          // move the endpoints along with the node
          updateNodeField(id, 'startPoint', {
            x: dragStartRef.current.startPoint.x + dx,
            y: dragStartRef.current.startPoint.y + dy,
          });
          updateNodeField(id, 'endPoint', {
            x: dragStartRef.current.endPoint.x + dx,
            y: dragStartRef.current.endPoint.y + dy,
          });
        }

        onNodesChange([{ id, type: 'position', position: newPos }]);
        return;
      }

      if (isResizing) {
        const dx = e.clientX - resizeStart.current.x;
        const dy = e.clientY - resizeStart.current.y;
        let newWidth = resizeStart.current.width;
        let newHeight = resizeStart.current.height;
        let newX = resizeStart.current.position.x;
        let newY = resizeStart.current.position.y;

        if (isResizing.includes('right')) newWidth += dx;
        if (isResizing.includes('left')) {
          newWidth -= dx;
          newX += dx;
        }
        if (isResizing.includes('bottom')) newHeight += dy;
        if (isResizing.includes('top')) {
          newHeight -= dy;
          newY += dy;
        }

        if (newWidth > 10 && newHeight > 10) {
          onNodesChange([
            { id, type: 'position', position: { x: newX, y: newY } },
            { id, type: 'dimensions', dimensions: { width: newWidth, height: newHeight } }
          ]);
        }
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(null);
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp, { once: true });
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isDragging, isResizing, onNodesChange, updateNodeField, id, type, position, width, height]);

  return (
    <div
      className={`node-wrapper ${selected ? 'selected' : ''}`}
      style={{
        left: position.x,
        top: position.y,
        width,
        height,
      }}
      onMouseDown={onMouseDown}
    >
      {children}
      {/* Lines should not have 4-corner box resizers */}
      {selected && type !== 'line' && <Resizer onResizeStart={onResizeStart} />}
    </div>
  );
};

/**
 * Visibility is toggled by storing timestamps in node.data.timestamps.
 * A node is visible if the count of timestamps <= currentTime is odd.
 */
export const useNodeVisibility = (id, data = {}) => {
  const { toggleTimestamp, currentTime } = useStore((state) => ({
    toggleTimestamp: state.toggleTimestamp,
    currentTime: state.currentTime,
  }));

  const timestamps = data.timestamps || [];
  const pastTimestampsCount = timestamps.filter((t) => t <= currentTime).length;
  const isVisible = pastTimestampsCount % 2 !== 0;

  const toggleVisibility = () => toggleTimestamp(id);

  return { isVisible, toggleVisibility };
};

export const NodeVisibilityButton = ({ isVisible, toggleVisibility }) => {
  return (
    <button
      type="button"
      title={isVisible ? 'Hide Component' : 'Show Component'}
      onClick={toggleVisibility}
      style={{ opacity: isVisible ? 1 : 0.5 }}
    >
      {isVisible ? '👁️' : '🚫'}
    </button>
  );
};
