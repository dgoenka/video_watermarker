// context.js
import { createContext, useContext, useState } from 'react';

const ReactFlowContext = createContext(null);

export const ReactFlowProvider = ({ children }) => {
  const [reactFlowInstance, setReactFlowInstance] = useState(null);

  return (
    <ReactFlowContext.Provider value={{ reactFlowInstance, setReactFlowInstance }}>
      {children}
    </ReactFlowContext.Provider>
  );
};

export const useReactFlowContext = () => {
  return useContext(ReactFlowContext);
};
