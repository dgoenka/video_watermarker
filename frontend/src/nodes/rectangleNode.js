// rectangleNode.js
import React from 'react';
import { withNodeFeatures } from './withNodeFeatures';
import { getBackgroundStyle } from '../utils';

const RectangleNodeComponent = ({ styles, isVisible }) => {
  return (
    <div
      className="node-body custom-drag-handle"
      style={{
        width: '100%',
        height: '100%',
        background: getBackgroundStyle(styles),
        border: `${styles.borderWidth}px ${styles.borderStyle} ${styles.borderColor}`,
        borderRadius: `${styles.borderRadius}px`,
        opacity: isVisible ? styles.opacity : 0,
        boxShadow: styles.hasShadow ? `${styles.shadowOffsetX}px ${styles.shadowOffsetY}px ${styles.shadowBlur}px ${styles.shadowColor}` : 'none',
        pointerEvents: isVisible ? 'all' : 'none',
        boxSizing: 'border-box',
      }}
    />
  );
};

export const RectangleNode = withNodeFeatures(RectangleNodeComponent);
