// NodeWrapper.js
import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store';
import { RotationHandle } from './RotationHandle';
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
  const { onNodesChange, selectNode, updateNodeField, nodes, canvasDimensions } = useStore(state => ({
    onNodesChange: state.onNodesChange,
    selectNode: state.selectNode,
    updateNodeField: state.updateNodeField,
    nodes: state.nodes,
    canvasDimensions: state.canvasDimensions,
  }));

  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ x: 0, y: 0, width: 0, height: 0, position: { x: 0, y: 0 } });

  const node = nodes.find(n => n.id === id);
  const rotation = node?.data?.rotation || 0;

  const constrainToCanvas = (pos, w, h) => {
    if (canvasDimensions.width === 0 || canvasDimensions.height === 0) return pos;
    return {
      x: Math.max(0, Math.min(pos.x, canvasDimensions.width - w)),
      y: Math.max(0, Math.min(pos.y, canvasDimensions.height - h))
    };
  };

  const onMouseDown = (e) => {
    if (e.target.classList.contains('resizer') || e.target.closest('.rotation-handle')) return;
    
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
        const newPos = constrainToCanvas({
          x: e.clientX - dragOffset.current.x,
          y: e.clientY - dragOffset.current.y,
        }, width, height);
        onNodesChange([{ id, type: 'position', position: newPos }]);
      } else if (isResizing) {
        const dx = e.clientX - resizeStart.current.x;
        const dy = e.clientY - resizeStart.current.y;
        
        const rad = (rotation * Math.PI) / 180;
        const cos = Math.cos(-rad);
        const sin = Math.sin(-rad);
        const rotatedDx = dx * cos - dy * sin;
        const rotatedDy = dx * sin + dy * cos;
        
        let newWidth = resizeStart.current.width;
        let newHeight = resizeStart.current.height;
        let newX = resizeStart.current.position.x;
        let newY = resizeStart.current.position.y;

        if (isResizing.includes('right')) newWidth += rotatedDx;
        if (isResizing.includes('left')) {
          newWidth -= rotatedDx;
          const deltaX = -rotatedDx * cos;
          const deltaY = -rotatedDx * sin;
          newX += deltaX;
          newY += deltaY;
        }
        if (isResizing.includes('bottom')) newHeight += rotatedDy;
        if (isResizing.includes('top')) {
          newHeight -= rotatedDy;
          const deltaX = rotatedDy * sin;
          const deltaY = -rotatedDy * cos;
          newX += deltaX;
          newY += deltaY;
        }

        const constrainedPos = constrainToCanvas({ x: newX, y: newY }, newWidth, newHeight);

        if (newWidth > 10 && newHeight > 10) {
          onNodesChange([
            { id, type: 'position', position: constrainedPos },
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
  }, [isDragging, isResizing, onNodesChange, id, rotation]);

  return (
  <div
    className={`node-wrapper ${type ? `node-wrapper--${type}` : ''} ${selected ? 'selected' : ''}`}
    style={{
      left: position.x,
      top: position.y,
      width,
      height,
      transform: `rotate(${rotation}deg)`,
      transformOrigin: 'center',
    }}
    onMouseDown={onMouseDown}
  >
    {children}
    {selected && type !== 'line' && (
      <>
        <Resizer onResizeStart={onResizeStart} />
        <RotationHandle id={id} rotation={rotation} />
      </>
    )}
  </div>
);
};
