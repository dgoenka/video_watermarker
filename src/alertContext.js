// alertContext.js
import React, { createContext, useContext, useState, useCallback } from 'react';
import { Dialog } from './Dialog';

const AlertContext = createContext(null);

export const AlertProvider = ({ children }) => {
  const [dialogState, setDialogState] = useState({
    isOpen: false,
    title: '',
    message: '',
  });

  const showAlert = useCallback((title, message) => {
    setDialogState({ isOpen: true, title, message });
  }, []);

  const closeAlert = useCallback(() => {
    setDialogState({ isOpen: false, title: '', message: '' });
  }, []);

  return (
    <AlertContext.Provider value={{ showAlert }}>
      {children}
      <Dialog
        isOpen={dialogState.isOpen}
        title={dialogState.title}
        message={dialogState.message}
        onClose={closeAlert}
      />
    </AlertContext.Provider>
  );
};

export const useAlert = () => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
};
