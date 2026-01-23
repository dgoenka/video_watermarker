// toolbar.js
import { useRef } from 'react';
import { useStore } from './store';
import { LayersPanel } from './LayersPanel';
import './ui.css';
import './toolbar.css';

export const PipelineToolbar = ({ videoDimensions }) => {
    const fileInputRef = useRef(null);
    const { addNode, getNodeID, setDrawingMode, drawingMode } = useStore(state => ({
        addNode: state.addNode,
        getNodeID: state.getNodeID,
        setDrawingMode: state.setDrawingMode,
        drawingMode: state.drawingMode,
    }));

    const handleFileButtonClick = (e) => {
        e.preventDefault();
        fileInputRef.current?.click();
    };

    const onFileSelect = (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    let newW, newH;
                    if (videoDimensions && videoDimensions.width > 0) {
                        const minDim = Math.min(videoDimensions.width, videoDimensions.height);
                        const targetSize = minDim * 0.2; // Make default image a bit larger
                        
                        if (img.width > img.height) {
                            newW = targetSize;
                            newH = (img.height / img.width) * newW;
                        } else {
                            newH = targetSize;
                            newW = (img.width / img.height) * newH;
                        }
                    } else {
                        newW = 200; // fallback
                        newH = 100;
                    }

                    // Place in the center of the canvas
                    const newX = videoDimensions ? (videoDimensions.width - newW) / 2 : 100;
                    const newY = videoDimensions ? (videoDimensions.height - newH) / 2 : 100;

                    const nodeID = getNodeID('picture');
                    const newNode = {
                        id: nodeID,
                        type: 'picture',
                        position: { x: newX, y: newY },
                        data: { image: e.target.result },
                        width: newW,
                        height: newH,
                        selected: true,
                    };
                    addNode(newNode);
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    };

    const toggleDrawingMode = (mode) => {
        if (drawingMode === mode) {
            setDrawingMode(null);
        } else {
            setDrawingMode(mode);
        }
    };

    return (
        <div className="pipeline-toolbar">
            <div className="toolbar-nodes-container">
                <button 
                    className={`icon-button ${drawingMode === 'rectangle' ? 'active' : ''}`} 
                    onClick={() => toggleDrawingMode('rectangle')} 
                    title="Rectangle"
                >
                    <div className="icon-shape rectangle" />
                </button>
                <button 
                    className={`icon-button ${drawingMode === 'circle' ? 'active' : ''}`} 
                    onClick={() => toggleDrawingMode('circle')} 
                    title="Circle"
                >
                    <div className="icon-shape circle" />
                </button>
                <button type="button" className="icon-button" onClick={handleFileButtonClick} title="Picture">
                    <span className="icon-shape picture">🖼️</span>
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={onFileSelect} style={{ display: 'none' }} />
                <button 
                    className={`icon-button ${drawingMode === 'text' ? 'active' : ''}`} 
                    onClick={() => toggleDrawingMode('text')} 
                    title="Text"
                >
                    <span className="icon-shape text">T</span>
                </button>
                <button 
                    className={`icon-button ${drawingMode === 'line' ? 'active' : ''}`} 
                    onClick={() => toggleDrawingMode('line')} 
                    title="Line"
                >
                    <div className="icon-shape line" style={{ width: '20px', height: '2px', background: '#333', transform: 'rotate(-45deg)' }} />
                </button>
            </div>
            <LayersPanel />
        </div>
    );
};
