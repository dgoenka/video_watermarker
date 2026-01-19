// pictureNode.js
import React, { useEffect, useState } from 'react';
import { withNodeFeatures } from './withNodeFeatures';

const PictureNodeComponent = ({ data, styles, isVisible }) => {
  return (
    <div
      className="node-body custom-drag-handle"
      style={{
        width: '100%',
        height: '100%',
        background: `url(${data.image})`,
        backgroundSize: '100% 100%',
        backgroundRepeat: 'no-repeat',
        opacity: isVisible ? styles.opacity : 0,
        pointerEvents: isVisible ? 'all' : 'none',
        borderRadius: `${styles.borderRadius}px`,
        border: `${styles.borderWidth}px ${styles.borderStyle} ${styles.borderColor}`,
        boxShadow: styles.hasShadow ? `${styles.shadowOffsetX}px ${styles.shadowOffsetY}px ${styles.shadowBlur}px ${styles.shadowColor}` : 'none',
        boxSizing: 'border-box',
      }}
    />
  );
};

export const PictureNode = withNodeFeatures(PictureNodeComponent);
