import {useRef, useCallback, useState, useEffect} from 'react';
import {useStore} from './store';
import {shallow} from 'zustand/shallow';

import {RectangleNode} from './nodes/rectangleNode';
import {CircleNode} from './nodes/circleNode';
import {PictureNode} from './nodes/pictureNode';
import {TextNode} from './nodes/textNode';
import {LineNode} from './nodes/lineNode';

import {PipelineToolbar} from './toolbar';
import {VideoControls} from './VideoControls';
import {NodeWrapper} from './nodes/nodewrapper';

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

export default function PipelineUI({videoFile, videoDimensions}) {
    const canvasWrapperRef = useRef(null);
    const videoRef = useRef(null);

    // Always call hooks at top level to satisfy React rules of hooks.
    const setCanvasDimensions = useStore(state => state.setCanvasDimensions);
    const {
        nodes,
        getNodeID,
        addNode,
        onNodesChange,
        unselectAll,
        drawingMode,
        setDrawingMode,
        updateNodeField,
    } = useStore(selector, shallow) || {};

    const [isDrawing, setIsDrawing] = useState(false);
    const [drawingStartPos, setDrawingStartPos] = useState(null);
    const [drawingNodeId, setDrawingNodeId] = useState(null);

    useEffect(() => {
        if (!videoDimensions) return;

        // Update canvas size to match the actual displayed video element size (not just natural video pixels).
        const updateCanvasSize = () => {
            let width = videoDimensions.width;
            let height = videoDimensions.height;
            try {
                if (videoRef.current) {
                    const rect = videoRef.current.getBoundingClientRect();
                    if (rect && rect.width > 0 && rect.height > 0) {
                        width = Math.round(rect.width);
                        height = Math.round(rect.height);
                    }
                }
            } catch (e) {
                // ignore and fall back to natural dimensions
            }
            if (canvasWrapperRef.current) {
                canvasWrapperRef.current.style.width = `${width}px`;
                canvasWrapperRef.current.style.height = `${height}px`;
            }   // This will also trigger scaling of existing nodes (store.setCanvasDimensions handles scaling)
            setCanvasDimensions({width, height});
        };
        updateCanvasSize(); // Watch for element resize (e.g., window resize, layout changes) and update canvas dimensions
        const ro = (typeof ResizeObserver !== 'undefined') ? new ResizeObserver(updateCanvasSize) : null;
        if (ro && videoRef.current) ro.observe(videoRef.current);
        window.addEventListener('resize', updateCanvasSize);
        return () => {
            if (ro && videoRef.current) ro.disconnect();
            window.removeEventListener('resize', updateCanvasSize);
        };
    }, [videoDimensions, setCanvasDimensions]);

    const getIntelligentLineColor = () => {
        if (!videoRef.current) return '#808080';

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 100;
        canvas.height = 100;

        try {
            ctx.drawImage(videoRef.current, 0, 0, 100, 100);
            const imageData = ctx.getImageData(0, 0, 100, 100);
            const data = imageData.data;

            let totalBrightness = 0;
            for (let i = 0; i < data.length; i += 4) {
                const brightness = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
                totalBrightness += brightness;
            }

            const avgBrightness = totalBrightness / (data.length / 4);
            const intensity = Math.max(0, Math.min(255, Math.round(255 - avgBrightness)));
            return `rgb(${intensity}, ${intensity}, ${intensity})`;
        } catch {
            return '#808080';
        }
    };

    const getIntelligentColors = () => {
        if (!videoRef.current) return {color1: '#808080', color2: '#404040'};

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 100;
        canvas.height = 100;

        try {
            ctx.drawImage(videoRef.current, 0, 0, 100, 100);
            const imageData = ctx.getImageData(0, 0, 100, 100);
            const data = imageData.data;

            let totalBrightness = 0;
            for (let i = 0; i < data.length; i += 4) {
                const brightness = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
                totalBrightness += brightness;
            }

            const avgBrightness = totalBrightness / (data.length / 4);
            const intensity1 = Math.max(0, Math.min(255, Math.round(255 - avgBrightness)));
            const intensity2 = Math.max(0, Math.min(255, Math.round((255 - avgBrightness + 128) % 256)));

            return {
                color1: `rgb(${intensity1}, ${intensity1}, ${intensity1})`,
                color2: `rgb(${intensity2}, ${intensity2}, ${intensity2})`
            };
        } catch {
            return {color1: '#808080', color2: '#404040'};
        }
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

        const bounds = canvasWrapperRef.current.getBoundingClientRect();
        const position = {
            x: event.clientX - bounds.left,
            y: event.clientY - bounds.top
        };
        const nodeID = getNodeID(drawingMode);

        const newNode = {
            id: nodeID,
            type: drawingMode,
            position,
            data: {
                nodeType: drawingMode,
                ...(drawingMode === 'line' && {styles: {borderColor: getIntelligentLineColor()}}),
                ...((drawingMode === 'rectangle' || drawingMode === 'circle') && (() => {
                    const {color1, color2} = getIntelligentColors();
                    return {styles: {borderColor: color1, fillColor: color2}};
                })()),
                ...(drawingMode === 'text' && {styles: {fontColor: getIntelligentLineColor()}})
            },
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

        const bounds = canvasWrapperRef.current.getBoundingClientRect();
        const currentPos = {
            x: event.clientX - bounds.left,
            y: event.clientY - bounds.top
        };
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
                {type: 'position', id: drawingNodeId, position: {x: minX, y: minY}},
                {type: 'dimensions', id: drawingNodeId, dimensions: {width: newWidth, height: newHeight}},
            ]);
            updateNodeField(drawingNodeId, 'startPoint', start);
            updateNodeField(drawingNodeId, 'endPoint', end);
        } else {
            onNodesChange([
                {id: drawingNodeId, type: 'position', position: {x, y}},
                {
                    id: drawingNodeId,
                    type: 'dimensions',
                    dimensions: {width: Math.max(1, width), height: Math.max(1, height)}
                },
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
                const end = {x: start.x + defaultSize, y: start.y};
                const intelligentColor = getIntelligentLineColor();
                addNode({
                    id: nodeID,
                    type: 'line',
                    position: {x: start.x, y: start.y - 5},
                    data: {
                        nodeType: 'line',
                        startPoint: start,
                        endPoint: end,
                        styles: {borderColor: intelligentColor}
                    },
                    width: defaultSize,
                    height: 10,
                    selected: true,
                });
            } else {
                addNode({
                    id: nodeID,
                    type: drawingMode,
                    position: {x: position.x - defaultSize / 2, y: position.y - defaultSize / 2},
                    data: {nodeType: drawingMode},
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
                    const end = {x: start.x + defaultSize, y: start.y};
                    const minX = Math.min(start.x, end.x);
                    const minY = Math.min(start.y, end.y);
                    const intelligentColor = getIntelligentLineColor();

                    onNodesChange([
                        {id: drawingNodeId, type: 'position', position: {x: minX, y: minY - 5}},
                        {id: drawingNodeId, type: 'dimensions', dimensions: {width: defaultSize, height: 10}},
                    ]);
                    updateNodeField(drawingNodeId, 'startPoint', start);
                    updateNodeField(drawingNodeId, 'endPoint', end);
                    updateNodeField(drawingNodeId, 'styles', {borderColor: intelligentColor});
                } else {
                    onNodesChange([
                        {id: drawingNodeId, type: 'dimensions', dimensions: {width: defaultSize, height: defaultSize}},
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
            <PipelineToolbar videoDimensions={videoDimensions}/>
            <div className="editor-container">
                <div className="canvas-container">
                    {videoFile && (
                        <video ref={videoRef} src={videoFile} className="background-video"/>
                    )}

                    <div
                        className="custom-canvas-wrapper"
                        ref={canvasWrapperRef}
                        onMouseDown={onMouseDown}
                        onMouseMove={onMouseMove}
                        onMouseUp={onMouseUp}
                        style={{
                            cursor: drawingMode ? 'crosshair' : 'default'
                        }}
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

                <VideoControls videoRef={videoRef}/>
            </div>
        </div>
    );
}
