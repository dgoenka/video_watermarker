// toolbarContext.js
import { createContext, useContext, useState } from 'react';

const ToolbarContext = createContext();

export const useToolbar = () => useContext(ToolbarContext);

export const ToolbarProvider = ({ children }) => {
  const [toolbarContent, setToolbarContent] = useState(null);

  return (
    <ToolbarContext.Provider value={{ toolbarContent, setToolbarContent }}>
      {children}
    </ToolbarContext.Provider>
  );
};
