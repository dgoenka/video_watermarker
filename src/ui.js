import { useRef, useCallback, useState } from 'react';
import { useStore } from './store';
import { shallow } from 'zustand/shallow';

import { RectangleNode } from './nodes/rectangleNode';
import { CircleNode } from './nodes/circleNode';
import { PictureNode } from './nodes/pictureNode';
import { TextNode } from './nodes/textNode';
import { LineNode } from './nodes/lineNode';

import { PipelineToolbar } from './toolbar';
import { VideoControls } from './VideoControls';
import { NodeWrapper } from './nodes/nodewrapper';

import './ui.css';

const nodeTypes = {
  rectangle: RectangleNode,
  circle: CircleNode,
  picture: PictureNode,
  text: TextNode,
  line: LineNode,
};

const selector = (state) => ({
  nodes: state.nodes,
  getNodeID: state.getNodeID,
  addNode: state.addNode,
  onNodesChange: state.onNodesChange,
  unselectAll: state.unselectAll,
  drawingMode: state.drawingMode,
  setDrawingMode: state.setDrawingMode,
  updateNodeField: state.updateNodeField,
});

export default function PipelineUI({ videoFile, videoDimensions }) {
  const canvasWrapperRef = useRef(null);
  const videoRef = useRef(null);

  const {
    nodes,
    getNodeID,
    addNode,
    onNodesChange,
    unselectAll,
    drawingMode,
    setDrawingMode,
    updateNodeField,
  } = useStore(selector, shallow);

  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingStartPos, setDrawingStartPos] = useState(null);
  const [drawingNodeId, setDrawingNodeId] = useState(null);

  const project = ({ x, y }) => {
    if (!canvasWrapperRef.current) return { x, y };
    const bounds = canvasWrapperRef.current.getBoundingClientRect();
    return { x: x - bounds.left, y: y - bounds.top };
  };

  const onMouseDown = useCallback((event) => {
    if (event.target.closest('.node-wrapper')) return;

    if (!drawingMode) {
      unselectAll();
      return;
    }

    if (isDrawing) {
      setIsDrawing(false);
      setDrawingNodeId(null);
      setDrawingStartPos(null);
      setDrawingMode(null);
      return;
    }

    const position = project({ x: event.clientX, y: event.clientY });
    const nodeID = getNodeID(drawingMode);
    
    const newNode = {
        id: nodeID,
        type: drawingMode,
        position,
        data: { nodeType: drawingMode },
        width: 0,
        height: 0,
        selected: true,
    };

    addNode(newNode);
    setDrawingNodeId(nodeID);
    setDrawingStartPos(position);
    setIsDrawing(true);
    unselectAll();
  }, [drawingMode, isDrawing, getNodeID, addNode, unselectAll, setDrawingMode]);

  const onMouseMove = useCallback((event) => {
    if (!isDrawing || !drawingNodeId || !drawingStartPos) return;

    const currentPos = project({ x: event.clientX, y: event.clientY });
    let width = currentPos.x - drawingStartPos.x;
    let height = currentPos.y - drawingStartPos.y;
    let x = drawingStartPos.x;
    let y = drawingStartPos.y;

    if (width < 0) {
      x = currentPos.x;
      width = Math.abs(width);
    }
    if (height < 0) {
      y = currentPos.y;
      height = Math.abs(height);
    }

    if (event.shiftKey) {
      const size = Math.max(width, height);
      width = size;
      height = size;
      if (currentPos.x < drawingStartPos.x) x = drawingStartPos.x - size;
      if (currentPos.y < drawingStartPos.y) y = drawingStartPos.y - size;
    }

    if (drawingMode === 'line') {
      const start = drawingStartPos;
      const end = currentPos;
      const minX = Math.min(start.x, end.x);
      const minY = Math.min(start.y, end.y);
      const newWidth = Math.abs(end.x - start.x) || 1;
      const newHeight = Math.abs(end.y - start.y) || 1;

      onNodesChange([
        { type: 'position', id: drawingNodeId, position: { x: minX, y: minY } },
        { type: 'dimensions', id: drawingNodeId, dimensions: { width: newWidth, height: newHeight } },
      ]);
      updateNodeField(drawingNodeId, 'startPoint', start);
      updateNodeField(drawingNodeId, 'endPoint', end);
    } else {
      onNodesChange([
        { id: drawingNodeId, type: 'position', position: { x, y } },
        { id: drawingNodeId, type: 'dimensions', dimensions: { width: Math.max(1, width), height: Math.max(1, height) } },
      ]);
    }
  }, [
    isDrawing,
    drawingStartPos,
    drawingNodeId,
    drawingMode,
    onNodesChange,
    updateNodeField,
  ]);

  const onMouseUp = useCallback(() => {
    if (!isDrawing) return;

    if (!drawingNodeId && drawingStartPos && drawingMode) {
      const nodeID = getNodeID(drawingMode);
      const defaultSize = 100;
      const position = drawingStartPos;

      if (drawingMode === 'line') {
        const start = drawingStartPos;
        const end = { x: start.x + defaultSize, y: start.y };
        addNode({
          id: nodeID,
          type: 'line',
          position: { x: start.x, y: start.y - 5 },
          data: { nodeType: 'line', startPoint: start, endPoint: end },
          width: defaultSize,
          height: 10,
          selected: true,
        });
      } else {
        addNode({
          id: nodeID,
          type: drawingMode,
          position: { x: position.x - defaultSize / 2, y: position.y - defaultSize / 2 },
          data: { nodeType: drawingMode },
          width: defaultSize,
          height: defaultSize,
          selected: true,
        });
      }
    } else if (drawingNodeId) {
      const node = nodes.find(n => n.id === drawingNodeId);
      if (node && (node.width < 10 || node.height < 10)) {
        const defaultSize = 100;
        if (drawingMode === 'line') {
          const start = node.data.startPoint || drawingStartPos;
          const end = { x: start.x + defaultSize, y: start.y };
          const minX = Math.min(start.x, end.x);
          const minY = Math.min(start.y, end.y);

          onNodesChange([
            { id: drawingNodeId, type: 'position', position: { x: minX, y: minY - 5 } },
            { id: drawingNodeId, type: 'dimensions', dimensions: { width: defaultSize, height: 10 } },
          ]);
          updateNodeField(drawingNodeId, 'startPoint', start);
          updateNodeField(drawingNodeId, 'endPoint', end);
        } else {
          onNodesChange([
            { id: drawingNodeId, type: 'dimensions', dimensions: { width: defaultSize, height: defaultSize } },
          ]);
        }
      }
    }

    setIsDrawing(false);
    setDrawingNodeId(null);
    setDrawingStartPos(null);
    unselectAll();
    setDrawingMode(null);
  }, [
    isDrawing,
    drawingNodeId,
    drawingStartPos,
    drawingMode,
    nodes,
    getNodeID,
    addNode,
    onNodesChange,
    unselectAll,
    setDrawingMode,
    updateNodeField,
  ]);

  return (
    <div className="main-content">
      <PipelineToolbar videoDimensions={videoDimensions} />
      <div className="editor-container">
        <div className="canvas-container">
          {videoFile && (
            <video ref={videoRef} src={videoFile} className="background-video" />
          )}

          <div
            className="custom-canvas-wrapper"
            ref={canvasWrapperRef}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            style={{ cursor: drawingMode ? 'crosshair' : 'default' }}
          >
            {nodes.map((node) => {
              const NodeComponent = nodeTypes[node.type];
              if (!NodeComponent) return null;

              return (
                <NodeWrapper
                  key={node.id}
                  id={node.id}
                  type={node.type}
                  position={node.position}
                  width={node.width}
                  height={node.height}
                  selected={node.selected}
                >
                  <NodeComponent {...node} />
                </NodeWrapper>
              );
            })}
          </div>
        </div>

        <VideoControls videoRef={videoRef} />
      </div>
    </div>
  );
}
