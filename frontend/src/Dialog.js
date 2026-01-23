// Dialog.js
import React from 'react';
import './Dialog.css';

export const Dialog = ({ isOpen, title, message, onClose }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-content" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">{title}</div>
        <div className="dialog-body">{message}</div>
        <div className="dialog-footer">
          <button className="dialog-button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
