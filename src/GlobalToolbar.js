// GlobalToolbar.js
import { useStore } from './store';
import { shallow } from 'zustand/shallow';
import { StylePopover } from './nodes/StylePopover';
import { NodeVisibilityButton } from './nodes/NodeVisibility';
import './GlobalToolbar.css';

const selector = (state) => ({
  nodes: state.nodes,
  toggleSelectedTimestamps: state.toggleSelectedTimestamps,
  currentTime: state.currentTime,
  removeNode: state.removeNode,
  updateNodeStyles: state.updateNodeStyles,
});

export const GlobalToolbar = ({ submitButton }) => {
  const { nodes, toggleSelectedTimestamps, currentTime, removeNode, updateNodeStyles } = useStore(selector, shallow);
  const selectedNodes = nodes.filter(n => n.selected);

  if (selectedNodes.length === 0) {
    return (
      <div className="global-toolbar">
        <div className="toolbar-left">
          <span className="app-name">Video Canva</span>
          <span className="page-title">My Project</span>
        </div>
        <div className="toolbar-right">
          {submitButton}
        </div>
      </div>
    );
  }

  if (selectedNodes.length > 1) {
    const ids = selectedNodes.map(n => n.id).join(', ');
    const areAllVisible = selectedNodes.every(node => {
        const timestamps = node.data.timestamps || [];
        return (timestamps.filter(t => t <= currentTime).length % 2) !== 0;
    });
    const areAllHidden = selectedNodes.every(node => {
        const timestamps = node.data.timestamps || [];
        return (timestamps.filter(t => t <= currentTime).length % 2) === 0;
    });

    let buttonIcon = '👁️';
    let buttonOpacity = 1;
    let buttonTitle = "Hide Selected";

    if (areAllVisible) {
        buttonIcon = '👁️';
        buttonOpacity = 1;
        buttonTitle = "Hide Selected";
    } else if (areAllHidden) {
        buttonIcon = '🚫';
        buttonOpacity = 0.5;
        buttonTitle = "Show Selected";
    } else {
        buttonIcon = '🌗';
        buttonOpacity = 0.8;
        buttonTitle = "Make All Visible";
    }

    return (
      <div className="global-toolbar">
        <div className="toolbar-left">
          <span>Multiselect: <b>{ids}</b></span>
        </div>
        <div className="toolbar-right">
          <div className="node-controls">
            <button 
              type="button" 
              title={buttonTitle} 
              onClick={toggleSelectedTimestamps}
              style={{ opacity: buttonOpacity }}
            >
              {buttonIcon}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Single node selected
  const node = selectedNodes[0];
  const isVisible = (node.data.timestamps || []).filter(t => t <= currentTime).length % 2 !== 0;
  
  // Helper to update styles for the selected node
  const setStyles = (updater) => {
      const currentStyles = node.data.styles || {};
      const newStyles = typeof updater === 'function' ? updater(currentStyles) : updater;
      updateNodeStyles(node.id, newStyles);
  };

  // Ensure styles object exists (fallback to defaults if needed, though nodes should init it)
  const styles = node.data.styles || {};

  return (
    <div className="global-toolbar">
      <div className="toolbar-left">
        <span>{node.type.charAt(0).toUpperCase() + node.type.slice(1)} : <b>{node.id}</b></span>
      </div>
      <div className="toolbar-right">
        <div className="node-controls">
          <StylePopover nodeType={node.type} styles={styles} setStyles={setStyles} />
          <NodeVisibilityButton isVisible={isVisible} toggleVisibility={() => toggleSelectedTimestamps()} />
        </div>
        <button type="button" className="dismiss-button" onClick={() => removeNode(node.id)}>&#x2715;</button>
      </div>
    </div>
  );
};
