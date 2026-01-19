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

export const NodeWrapper = ({ id, children, position, width, height, selected, type }) => {
  const { onNodesChange, selectNode } = useStore(state => ({
    onNodesChange: state.onNodesChange,
    selectNode: state.selectNode,
  }));

  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ x: 0, y: 0, width: 0, height: 0, position: { x: 0, y: 0 } });

  const onMouseDown = (e) => {
    // Prevent starting drag if a resize handle was clicked
    if (e.target.classList.contains('resizer')) return;
    
    e.stopPropagation();
    setIsDragging(true);
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
    selectNode(id, e.shiftKey);
  };

  const onResizeStart = (e, direction) => {
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
      if (isDragging) {
        const newPos = {
          x: e.clientX - dragOffset.current.x,
          y: e.clientY - dragOffset.current.y,
        };
        onNodesChange([{ id, type: 'position', position: newPos }]);
      } else if (isResizing) {
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
  }, [isDragging, isResizing, onNodesChange, id]);

  return (
  <div
    className={`node-wrapper ${type ? `node-wrapper--${type}` : ''} ${selected ? 'selected' : ''}`}
    style={{
      left: position.x,
      top: position.y,
      width,
      height,
    }}
    onMouseDown={onMouseDown}
  >
    {children}
    {selected && type !== 'line' && <Resizer onResizeStart={onResizeStart} />}
  </div>
);
};
