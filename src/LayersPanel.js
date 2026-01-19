// LayersPanel.js
import { useStore } from './store';
import { shallow } from 'zustand/shallow';
import './LayersPanel.css';

const selector = (state) => ({
  nodes: state.nodes,
  selectNode: state.selectNode,
  moveNodeUp: state.moveNodeUp,
  moveNodeDown: state.moveNodeDown,
});

export const LayersPanel = () => {
  const { nodes, selectNode, moveNodeUp, moveNodeDown } = useStore(selector, shallow);

  // Reverse nodes for display so top layer is first in list
  const displayNodes = [...nodes].reverse();

  return (
    <div className="layers-panel">
      <div className="layers-header">Layers</div>
      <div className="layers-list">
        {displayNodes.map((node) => (
          <div
            key={node.id}
            className={`layer-item ${node.selected ? 'selected' : ''}`}
            onClick={(e) => { 
                e.preventDefault(); 
                // Pass shiftKey to support multiselect from layers panel
                selectNode(node.id, e.shiftKey); 
            }}
          >
            <span className="layer-name">{node.data.nodeType} #{node.id}</span>
            <div className="layer-controls">
              <button
                className="layer-btn"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); moveNodeUp(node.id); }}
                disabled={nodes.indexOf(node) === nodes.length - 1}
              >
                ↑
              </button>
              <button
                className="layer-btn"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); moveNodeDown(node.id); }}
                disabled={nodes.indexOf(node) === 0}
              >
                ↓
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
