// withNodeFeatures.js

/**
 * Minimal wrapper used by node components.
 * - Keeps timestamp-based visibility logic
 * - Supplies `styles` and `isVisible` props expected by nodes
 * - Intentionally does NOT render any ReactFlow resizers/handles
 */
import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store';
import { useNodeVisibility } from './NodeVisibility';
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

  const dragStartRef = useRef({
    position: { x: 0, y: 0 },
    startPoint: null,
    endPoint: null,
  });

  const resizeStart = useRef({ x: 0, y: 0, width: 0, height: 0, position: { x: 0, y: 0 } });

  const onMouseDown = (e) => {
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

    dragStartRef.current.position = { ...position };

    if (type === 'line') {
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
      {selected && type !== 'line' && <Resizer onResizeStart={onResizeStart} />}
    </div>
  );
};

export const withNodeFeatures = (WrappedComponent) => {
  return ({ id, data = {}, selected, ...props }) => {
    const { isVisible } = useNodeVisibility(id, data);
    const styles = data.styles || {};
    const rotation = data.rotation || 0;

    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          transform: `rotate(${rotation}deg)`,
          transformOrigin: 'center',
        }}
      >
        <WrappedComponent
          id={id}
          data={data}
          selected={selected}
          styles={styles}
          isVisible={isVisible}
          {...props}
        />
      </div>
    );
  };
};
