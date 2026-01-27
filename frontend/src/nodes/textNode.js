// textNode.js
import React, { useState, useLayoutEffect, useRef, useEffect } from 'react';
import { useStore } from '../store';
import { withNodeFeatures } from './withNodeFeatures';
import { getBackgroundStyle } from '../utils';

const TextNodeComponent = ({ id, data, styles, isVisible }) => {
  const [text, setText] = useState(data.text || 'Enter text');
  const [isEditing, setIsEditing] = useState(false);
  const onNodesChange = useStore((state) => state.onNodesChange);
  const textRef = useRef(null);

  useLayoutEffect(() => {
    if (textRef.current) {
        const { offsetWidth, offsetHeight } = textRef.current;
        if (data.width !== offsetWidth || data.height !== offsetHeight) {
            onNodesChange([{
                type: 'dimensions',
                id,
                dimensions: { width: offsetWidth, height: offsetHeight }
            }]);
        }
    }
  }, [text, styles, id, onNodesChange, data.width, data.height]);

  useEffect(() => {
    if (textRef.current && !isEditing) {
      const storedText = data.text || text;
      if (textRef.current.innerText !== storedText) {
        textRef.current.innerText = storedText;
      }
    }
  }, [text, isEditing, data.text]);

  useEffect(() => {
    if (isEditing && textRef.current) {
      textRef.current.focus();
    }
  }, [isEditing]);

  const handleInput = (e) => {
    setText(e.target.innerText);
    onNodesChange([{
      type: 'data',
      id,
      data: { ...data, text: e.target.innerText }
    }]);
  };

  const handleKeyDown = (e) => {
      if (e.metaKey || e.ctrlKey) {
          if (e.key === 'a') {
              e.stopPropagation();
          }
      }
  };

  const getTextStyles = () => {
      const baseStyles = {
          fontFamily: styles.fontFamily,
          fontSize: `${styles.fontSize}px`,
          fontWeight: styles.isBold ? 'bold' : 'normal',
          fontStyle: styles.isItalic ? 'italic' : 'normal',
          textDecoration: styles.isUnderline ? 'underline' : 'none',
          textAlign: styles.textAlign,
          textShadow: styles.hasShadow ? `${styles.shadowOffsetX}px ${styles.shadowOffsetY}px ${styles.shadowBlur}px ${styles.shadowColor}` : 'none',
          lineHeight: 1.2,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          padding: '2px',
          margin: 0,
          outline: 'none',
          minHeight: `${styles.fontSize * 1.2}px`,
          display: 'flex',
          alignItems: styles.textAlign === 'center' ? 'center' : (styles.textAlign === 'right' ? 'flex-end' : 'flex-start'),
          justifyContent: styles.textAlign === 'center' ? 'center' : (styles.textAlign === 'right' ? 'flex-end' : 'flex-start'),
      };

      if (styles.textFillType === 'gradient') {
          return {
              ...baseStyles,
              background: `linear-gradient(${styles.textGradientAngle}deg, ${styles.textGradientColor1}, ${styles.textGradientColor2})`,
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              color: 'transparent',
              caretColor: styles.textGradientColor1,
          };
      } else if (styles.textFillType === 'radial') {
          return {
              ...baseStyles,
              background: `radial-gradient(circle, ${styles.textGradientColor1}, ${styles.textGradientColor2})`,
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              color: 'transparent',
              caretColor: styles.textGradientColor1,
          };
      } else {
          return {
              ...baseStyles,
              color: styles.fontColor,
              caretColor: styles.fontColor,
          };
      }
  };

  return (
    <div
      className={`node-body ${isEditing ? 'nodrag' : 'custom-drag-handle'}`}
      style={{
          width: '100%',
          height: '100%',
          background: getBackgroundStyle(styles),
          border: `${styles.borderWidth}px ${styles.borderStyle} ${styles.borderColor}`,
          borderRadius: `${styles.borderRadius}px`,
          opacity: isVisible ? styles.opacity : 0,
          pointerEvents: isVisible ? 'auto' : 'none',
          cursor: isEditing ? 'text' : 'grab',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
      }}
      onDoubleClick={() => setIsEditing(true)}
    >
        <div
          ref={textRef}
          contentEditable={isEditing}
          suppressContentEditableWarning={true}
          onInput={handleInput}
          onBlur={() => setIsEditing(false)}
          onKeyDown={handleKeyDown}
          style={{
            width: '100%',
            height: '100%',
            ...getTextStyles(),
            cursor: isEditing ? 'text' : 'inherit',
            overflow: 'hidden',
            boxSizing: 'border-box',
          }}
        />
    </div>
  );
};

export const TextNode = withNodeFeatures(TextNodeComponent);
