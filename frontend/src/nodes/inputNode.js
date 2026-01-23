// inputNode.js

import { useState } from 'react';
import { NodeWrapper } from './nodewrapper';
import { useStore } from '../store';
import { shallow } from 'zustand/shallow';

const selector = (state) => ({
    nodes: state.nodes,
});

export const InputNode = ({ id, data }) => {
  const [currName, setCurrName] = useState(data?.inputName || id.replace('customInput-', 'input_'));
  const [inputType, setInputType] = useState(data.inputType || 'Text');
  const { nodes } = useStore(selector, shallow);

  const handleNameChange = (e) => {
    setCurrName(e.target.value);
  };

  const handleTypeChange = (e) => {
    setInputType(e.target.value);
  };

  const baseName = id;

  return (
    <NodeWrapper title="Input" id={id}>
      <div>
        <label>
          Name:
          <input 
            type="text" 
            name={`${baseName}__name`}
            value={currName} 
            placeholder="Enter name"
            onChange={handleNameChange}
            required
          />
        </label>
        <label>
          Type:
          <select 
            name={`${baseName}__type`}
            value={inputType} 
            onChange={handleTypeChange}
            required
          >
            <option value="Text">Text</option>
            <option value="File">File</option>
          </select>
        </label>
      </div>
    </NodeWrapper>
  );
}
