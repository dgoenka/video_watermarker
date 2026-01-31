// store.js
import { create } from "zustand";
import { applyNodeChanges } from 'reactflow';
import { createContext, useContext, useRef } from 'react';

const defaultNodeStyles = {
    rectangle: {
        fillType: 'solid',
        fillColor: '#ffffff',
        gradientColor1: '#ffffff',
        gradientColor2: '#000000',
        gradientAngle: 90,
        borderColor: '#000000',
        borderWidth: 1,
        borderStyle: 'solid',
        borderRadius: 0,
        opacity: 0.5,
        hasShadow: false,
        shadowColor: '#000000',
        shadowOffsetX: 2,
        shadowOffsetY: 2,
        shadowBlur: 4,
    },
    circle: {
        fillType: 'solid',
        fillColor: '#ffffff',
        gradientColor1: '#ffffff',
        gradientColor2: '#000000',
        gradientAngle: 90,
        borderColor: '#000000',
        borderWidth: 1,
        borderStyle: 'solid',
        borderRadius: 50,
        opacity: 0.5,
        hasShadow: false,
        shadowColor: '#000000',
        shadowOffsetX: 2,
        shadowOffsetY: 2,
        shadowBlur: 4,
    },
    text: {
        fontFamily: 'Arial',
        fontSize: 16,
        fontColor: '#000000',
        isBold: false,
        isItalic: false,
        isUnderline: false,
        textAlign: 'left',
        textFillType: 'solid',
        textGradientColor1: '#ff0000',
        textGradientColor2: '#0000ff',
        textGradientAngle: 90,
        fillType: 'solid',
        fillColor: 'transparent',
        gradientColor1: '#ffffff',
        gradientColor2: '#000000',
        gradientAngle: 90,
        borderColor: 'transparent',
        borderWidth: 0,
        borderStyle: 'solid',
        borderRadius: 0,
        opacity: 1,
        hasShadow: false,
        shadowColor: '#000000',
        shadowOffsetX: 2,
        shadowOffsetY: 2,
        shadowBlur: 4,
    },
    picture: {
        opacity: 1,
        hasShadow: false,
        shadowColor: '#000000',
        shadowOffsetX: 2,
        shadowOffsetY: 2,
        shadowBlur: 4,
        borderRadius: 0,
        borderWidth: 0,
        borderStyle: 'solid',
        borderColor: '#000000',
    },
    line: {
        borderColor: '#ffffff',
        borderWidth: 2,
        borderStyle: 'solid',
        arrowStart: 'none',
        arrowEnd: 'none',
        opacity: 1,
        hasShadow: false,
        shadowColor: '#000000',
        shadowOffsetX: 2,
        shadowOffsetY: 2,
        shadowBlur: 4,
    }
};

const createStore = () => create((set, get) => ({
    nodes: [],
    nodeIDs: {},
    videoDimensions: { width: 0, height: 0 },
    canvasDimensions: { width: 0, height: 0 },
    currentTime: 0,
    drawingMode: null,
    setDrawingMode: (mode) => set({ drawingMode: mode }),
    setVideoDimensions: (dimensions) => set({ videoDimensions: dimensions }),
    setCanvasDimensions: (dimensions) => {
        const prevCanvas = get().canvasDimensions;
        if (prevCanvas.width > 0 && prevCanvas.height > 0 && 
            (prevCanvas.width !== dimensions.width || prevCanvas.height !== dimensions.height)) {
            // Scale existing nodes
            const scaleX = dimensions.width / prevCanvas.width;
            const scaleY = dimensions.height / prevCanvas.height;
            const nodes = get().nodes.map(node => ({
                ...node,
                position: { x: node.position.x * scaleX, y: node.position.y * scaleY },
                width: node.width * scaleX,
                height: node.height * scaleY,
                data: {
                    ...node.data,
                    styles: node.data.styles && node.data.styles.fontSize ? {
                        ...node.data.styles,
                        fontSize: Math.round(node.data.styles.fontSize * Math.min(scaleX, scaleY))
                    } : node.data.styles,
                    startPoint: node.data.startPoint ? {
                        x: node.data.startPoint.x * scaleX,
                        y: node.data.startPoint.y * scaleY
                    } : node.data.startPoint,
                    endPoint: node.data.endPoint ? {
                        x: node.data.endPoint.x * scaleX,
                        y: node.data.endPoint.y * scaleY
                    } : node.data.endPoint
                }
            }));
            set({ nodes, canvasDimensions: dimensions });
        } else {
            set({ canvasDimensions: dimensions });
        }
    },
    setCurrentTime: (time) => set({ currentTime: time }),
    getNodeID: (type) => {
        const newIDs = {...(get().nodeIDs || {})};
        if (newIDs[type] === undefined) {
            newIDs[type] = 0;
        }
        newIDs[type] += 1;
        set({nodeIDs: newIDs});
        return `${type}-${newIDs[type]}`;
    },
    addNode: (node) => {
        const newNodes = get().nodes.map(n => ({ ...n, selected: false }));
        const currentTime = get().currentTime;
        
        const initialStyles = defaultNodeStyles[node.type] || {};
        // Merge with node styles taking priority over defaults
        const mergedStyles = { ...initialStyles, ...(node.data?.styles || {}) };
        if (node.type === 'text' && node.data?.defaultFontSize) {
            mergedStyles.fontSize = node.data.defaultFontSize;
        }

        const nodeWithTime = {
            ...node,
            selected: true,
            zIndex: 10,
            data: {
                ...node.data,
                styles: mergedStyles,
                timestamps: [currentTime]
            }
        };
        set({
            nodes: [...newNodes, nodeWithTime]
        });
    },
    removeNode: (nodeId) => {
      set({
        nodes: get().nodes.filter(node => node.id !== nodeId)
      });
    },
    onNodesChange: (changes) => {
        set({
            nodes: applyNodeChanges(changes, get().nodes),
        });
    },
    updateNodeField: (nodeId, fieldName, fieldValue) => {
        set({
            nodes: get().nodes.map((node) => {
                if (node.id === nodeId) {
                    return { ...node, data: { ...node.data, [fieldName]: fieldValue } };
                }
                return node;
            }),
        });
    },
    updateNodeStyles: (nodeId, newStyles) => {
        set({
            nodes: get().nodes.map((node) => {
                if (node.id === nodeId) {
                    return { ...node, data: { ...node.data, styles: newStyles } };
                }
                return node;
            }),
        });
    },
    toggleTimestamp: (nodeId) => {
        const { currentTime } = get();
        set({
            nodes: get().nodes.map((node) => {
                if (node.id === nodeId) {
                    const timestamps = node.data.timestamps || [];
                    const isVisible = (timestamps.filter(t => t <= currentTime).length % 2) !== 0;
                    let newTimestamps = timestamps.filter(t => t < currentTime);
                    
                    if (!isVisible) {
                        newTimestamps.push(currentTime);
                    }
                    
                    newTimestamps.sort((a, b) => a - b);
                    return { ...node, data: { ...node.data, timestamps: newTimestamps } };
                }
                return node;
            }),
        });
    },
    toggleSelectedTimestamps: () => {
        const { currentTime, nodes } = get();
        const selectedNodes = nodes.filter(n => n.selected);
        if (selectedNodes.length === 0) return;

        const areAllVisible = selectedNodes.every(node => {
            const timestamps = node.data.timestamps || [];
            return (timestamps.filter(t => t <= currentTime).length % 2) !== 0;
        });

        const shouldBeVisible = !areAllVisible;

        set({
            nodes: nodes.map((node) => {
                if (node.selected) {
                    const timestamps = node.data.timestamps || [];
                    const isCurrentlyVisible = (timestamps.filter(t => t <= currentTime).length % 2) !== 0;
                    let newTimestamps = timestamps.filter(t => t < currentTime);

                    if ((shouldBeVisible && !isCurrentlyVisible) || (!shouldBeVisible && isCurrentlyVisible)) {
                        newTimestamps.push(currentTime);
                    }
                    
                    newTimestamps.sort((a, b) => a - b);
                    return { ...node, data: { ...node.data, timestamps: newTimestamps } };
                }
                return node;
            }),
        });
    },
    unselectAll: () => {
        set({
            nodes: get().nodes.map(n => ({ ...n, selected: false }))
        });
    },
    moveNodeUp: (nodeId) => {
        const nodes = get().nodes;
        const index = nodes.findIndex(n => n.id === nodeId);
        if (index < nodes.length - 1) {
            const newNodes = [...nodes];
            const [node] = newNodes.splice(index, 1);
            newNodes.splice(index + 1, 0, node);
            set({ nodes: newNodes });
        }
    },
    isDrawing: false,
    drawingNodeId: null,
    drawingStartPos: null,
    setIsDrawing: (drawing) => set({ isDrawing: drawing }),
    setDrawingNodeId: (id) => set({ drawingNodeId: id }),
    setDrawingStartPos: (pos) => set({ drawingStartPos: pos }),
    selectNode: (nodeId) => {
        set({
            nodes: get().nodes.map(n => ({ ...n, selected: n.id === nodeId }))
        });
    },
    moveNodeDown: (nodeId) => {
        const nodes = get().nodes;
        const index = nodes.findIndex(n => n.id === nodeId);
        if (index > 0) {
            const newNodes = [...nodes];
            const [node] = newNodes.splice(index, 1);
            newNodes.splice(index - 1, 0, node);
            set({ nodes: newNodes });
        }
    },
}));

const StoreContext = createContext(null);

export const StoreProvider = ({ children }) => {
  const storeRef = useRef();
  if (!storeRef.current) {
    storeRef.current = createStore();
  }
  return (
    <StoreContext.Provider value={storeRef.current}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = (selector) => {
  const store = useContext(StoreContext);
  if (!store) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return store(selector);
};
