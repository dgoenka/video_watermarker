// withNodeFeatures.js

/**
 * Minimal wrapper used by node components.
 * - Keeps timestamp-based visibility logic
 * - Supplies `styles` and `isVisible` props expected by nodes
 * - Intentionally does NOT render any ReactFlow resizers/handles
 */
import React from 'react';
import { useNodeVisibility } from './NodeVisibility';

export const withNodeFeatures = (WrappedComponent) => {
  return ({ id, data = {}, selected, ...props }) => {
    const { isVisible } = useNodeVisibility(id, data);
    const styles = data.styles || {};

    return (
      <WrappedComponent
        id={id}
        data={data}
        selected={selected}
        styles={styles}
        isVisible={isVisible}
        {...props}
      />
    );
  };
};
