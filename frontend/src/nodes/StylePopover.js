// StylePopover.js
import React, { useState, useRef, useLayoutEffect, useEffect } from 'react';
import ReactDOM from 'react-dom';
import './StylePopover.css';

const PRESET_COLORS = ['#ffffff', '#000000', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#00ffff', '#ff00ff'];

const ColorPalette = ({ color, onSelect, title }) => (
  <div className="style-control-group">
    <label>{title}</label>
    <div className="color-palette">
      {PRESET_COLORS.map(preset => (
        <div
          key={preset}
          onClick={() => onSelect(preset)}
          className="color-swatch"
          style={{ backgroundColor: preset, border: color === preset ? '2px solid #1976d2' : '1px solid #ddd' }}
          title={preset}
        />
      ))}
      <label className="color-swatch custom-color" title="Custom Color">
        <input type="color" value={color} onChange={(e) => onSelect(e.target.value)} />
      </label>
    </div>
  </div>
);

const Slider = ({ label, value, onChange, min, max, step, unit = '' }) => (
  <div className="style-control-group">
    <label>{label}: {value}{unit}</label>
    <input type="range" min={min} max={max} step={step} value={value} onChange={onChange} />
  </div>
);

export const StylePopover = ({ nodeType, styles, setStyles }) => {
  const [activeTab, setActiveTab] = useState(nodeType === 'text' ? 'text' : (nodeType === 'line' ? 'line' : 'fill'));
  const buttonRef = useRef(null);
  const popoverRef = useRef(null);
  const [popoverPosition, setPopoverPosition] = useState({});
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const handleStyleChange = (key, value) => {
    setStyles(prev => ({ ...prev, [key]: value }));
  };

  const closePopover = () => {
      setStyles(prev => ({ ...prev, show: false }));
  };

  // Initial positioning
  useLayoutEffect(() => {
    if (styles.show) {
      const initialX = window.innerWidth - 280 - 10; 
      const initialY = 60;
      setPopoverPosition({ top: initialY, left: initialX });
    }
  }, [styles.show]);

  // Dragging logic
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging) {
        setPopoverPosition({
          left: e.clientX - dragOffset.x,
          top: e.clientY - dragOffset.y,
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  const handleMouseDown = (e) => {
    if (e.target.closest('.popover-header')) {
        setIsDragging(true);
        const rect = popoverRef.current.getBoundingClientRect();
        setDragOffset({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        });
    }
  };

  const renderFillTab = () => (
    <>
      <div className="style-control-group">
        <label>Fill Type</label>
        <div className="segmented-control">
          <button type="button" className={styles.fillType === 'solid' ? 'active' : ''} onClick={() => handleStyleChange('fillType', 'solid')}>Solid</button>
          <button type="button" className={styles.fillType === 'gradient' ? 'active' : ''} onClick={() => handleStyleChange('fillType', 'gradient')}>Linear</button>
          <button type="button" className={styles.fillType === 'radial' ? 'active' : ''} onClick={() => handleStyleChange('fillType', 'radial')}>Radial</button>
        </div>
      </div>
      {styles.fillType === 'solid' ? (
        <ColorPalette title="Color" color={styles.fillColor} onSelect={val => handleStyleChange('fillColor', val)} />
      ) : (
        <>
          <ColorPalette title="Color 1" color={styles.gradientColor1} onSelect={val => handleStyleChange('gradientColor1', val)} />
          <ColorPalette title="Color 2" color={styles.gradientColor2} onSelect={val => handleStyleChange('gradientColor2', val)} />
          {styles.fillType === 'gradient' && (
            <Slider label="Angle" value={styles.gradientAngle} onChange={e => handleStyleChange('gradientAngle', e.target.value)} min="0" max="360" step="1" unit="°" />
          )}
        </>
      )}
    </>
  );

  const renderBorderTab = () => (
    <>
      <ColorPalette title="Color" color={styles.borderColor} onSelect={val => handleStyleChange('borderColor', val)} />
      <Slider label="Width" value={styles.borderWidth} onChange={e => handleStyleChange('borderWidth', e.target.value)} min="0" max="20" step="1" unit="px" />
      <div className="style-control-group">
        <label>Style</label>
        <select value={styles.borderStyle} onChange={e => handleStyleChange('borderStyle', e.target.value)}>
          <option value="solid">Solid</option>
          <option value="dashed">Dashed</option>
          <option value="dotted">Dotted</option>
        </select>
      </div>
      {nodeType !== 'circle' && nodeType !== 'text' && nodeType !== 'line' && (
        <Slider label="Radius" value={styles.borderRadius} onChange={e => handleStyleChange('borderRadius', e.target.value)} min="0" max="50" step="1" unit="px" />
      )}
    </>
  );

  const renderLineTab = () => (
    <>
      <ColorPalette title="Color" color={styles.borderColor} onSelect={val => handleStyleChange('borderColor', val)} />
      <Slider label="Thickness" value={styles.borderWidth} onChange={e => handleStyleChange('borderWidth', e.target.value)} min="1" max="20" step="1" unit="px" />
      <div className="style-control-group">
        <label>Style</label>
        <select value={styles.borderStyle} onChange={e => handleStyleChange('borderStyle', e.target.value)}>
          <option value="solid">Solid</option>
          <option value="dashed">Dashed</option>
          <option value="dotted">Dotted</option>
        </select>
      </div>
      <div className="style-control-group">
        <label>Start Arrow</label>
        <select value={styles.arrowStart} onChange={e => handleStyleChange('arrowStart', e.target.value)}>
          <option value="none">None</option>
          <option value="arrow">Arrow</option>
          <option value="circle">Circle</option>
        </select>
      </div>
      <div className="style-control-group">
        <label>End Arrow</label>
        <select value={styles.arrowEnd} onChange={e => handleStyleChange('arrowEnd', e.target.value)}>
          <option value="none">None</option>
          <option value="arrow">Arrow</option>
          <option value="circle">Circle</option>
        </select>
      </div>
    </>
  );

  const renderEffectsTab = () => (
    <>
      <Slider label="Opacity" value={styles.opacity} onChange={e => handleStyleChange('opacity', e.target.value)} min="0" max="1" step="0.1" />
      <div className="style-control-group">
        <label style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          Shadow
          <input 
            type="checkbox" 
            checked={styles.hasShadow} 
            onChange={e => handleStyleChange('hasShadow', e.target.checked)} 
            style={{ margin: 0 }}
          />
        </label>
      </div>
      {styles.hasShadow && (
        <div className="shadow-settings-group">
          <ColorPalette title="Color" color={styles.shadowColor} onSelect={val => handleStyleChange('shadowColor', val)} />
          <Slider label="Offset X" value={styles.shadowOffsetX} onChange={e => handleStyleChange('shadowOffsetX', e.target.value)} min="-20" max="20" step="1" unit="px" />
          <Slider label="Offset Y" value={styles.shadowOffsetY} onChange={e => handleStyleChange('shadowOffsetY', e.target.value)} min="-20" max="20" step="1" unit="px" />
          <Slider label="Blur" value={styles.shadowBlur} onChange={e => handleStyleChange('shadowBlur', e.target.value)} min="0" max="40" step="1" unit="px" />
        </div>
      )}
    </>
  );

  const renderTextTab = () => (
    <>
      <div className="style-control-group">
        <label>Font Family</label>
        <select value={styles.fontFamily} onChange={e => handleStyleChange('fontFamily', e.target.value)}>
          <option value="Arial">Arial</option>
          <option value="Verdana">Verdana</option>
          <option value="Times New Roman">Times New Roman</option>
          <option value="Courier New">Courier New</option>
          <option value="Georgia">Georgia</option>
          <option value="Trebuchet MS">Trebuchet MS</option>
        </select>
      </div>
      <Slider label="Size" value={styles.fontSize} onChange={e => handleStyleChange('fontSize', parseInt(e.target.value))} min="8" max="100" step="1" unit="px" />
      
      <div className="style-control-group">
        <label>Fill Type</label>
        <div className="segmented-control">
          <button type="button" className={styles.textFillType === 'solid' ? 'active' : ''} onClick={() => handleStyleChange('textFillType', 'solid')}>Solid</button>
          <button type="button" className={styles.textFillType === 'gradient' ? 'active' : ''} onClick={() => handleStyleChange('textFillType', 'gradient')}>Linear</button>
          <button type="button" className={styles.textFillType === 'radial' ? 'active' : ''} onClick={() => handleStyleChange('textFillType', 'radial')}>Radial</button>
        </div>
      </div>

      {styles.textFillType === 'solid' ? (
        <ColorPalette title="Color" color={styles.fontColor} onSelect={val => handleStyleChange('fontColor', val)} />
      ) : (
        <>
          <ColorPalette title="Color 1" color={styles.textGradientColor1} onSelect={val => handleStyleChange('textGradientColor1', val)} />
          <ColorPalette title="Color 2" color={styles.textGradientColor2} onSelect={val => handleStyleChange('textGradientColor2', val)} />
          {styles.textFillType === 'gradient' && (
            <Slider label="Angle" value={styles.textGradientAngle} onChange={e => handleStyleChange('textGradientAngle', e.target.value)} min="0" max="360" step="1" unit="°" />
          )}
        </>
      )}
      
      <div className="style-control-group">
        <label>Alignment</label>
        <div className="segmented-control">
          <button type="button" className={styles.textAlign === 'left' ? 'active' : ''} onClick={() => handleStyleChange('textAlign', 'left')}>Left</button>
          <button type="button" className={styles.textAlign === 'center' ? 'active' : ''} onClick={() => handleStyleChange('textAlign', 'center')}>Center</button>
          <button type="button" className={styles.textAlign === 'right' ? 'active' : ''} onClick={() => handleStyleChange('textAlign', 'right')}>Right</button>
        </div>
      </div>

      <div className="style-control-group">
        <label>Style</label>
        <div className="segmented-control">
          <button type="button" className={styles.isBold ? 'active' : ''} onClick={() => handleStyleChange('isBold', !styles.isBold)} style={{ fontWeight: 'bold' }}>B</button>
          <button type="button" className={styles.isItalic ? 'active' : ''} onClick={() => handleStyleChange('isItalic', !styles.isItalic)} style={{ fontStyle: 'italic' }}>I</button>
          <button type="button" className={styles.isUnderline ? 'active' : ''} onClick={() => handleStyleChange('isUnderline', !styles.isUnderline)} style={{ textDecoration: 'underline' }}>U</button>
        </div>
      </div>
    </>
  );

  return (
    <div className="popover-container">
      <button ref={buttonRef} type="button" title="Style" onClick={() => setStyles(prev => ({ ...prev, show: !prev.show }))}>🎨</button>
      {styles.show && ReactDOM.createPortal(
        <div 
          ref={popoverRef}
          className="popover style-popover" 
          onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e); }}
          style={{ top: popoverPosition.top, left: popoverPosition.left }}
        >
          <div className="popover-header">
            <span>Style Settings</span>
            <button type="button" className="close-btn" onClick={closePopover}>×</button>
          </div>
          <div className="popover-tabs">
            {nodeType === 'text' && (
                <button type="button" className={activeTab === 'text' ? 'active' : ''} onClick={() => setActiveTab('text')}>Text</button>
            )}
            {nodeType === 'line' ? (
                <button type="button" className={activeTab === 'line' ? 'active' : ''} onClick={() => setActiveTab('line')}>Line</button>
            ) : (
                <>
                    <button type="button" className={activeTab === 'fill' ? 'active' : ''} onClick={() => setActiveTab('fill')}>Fill</button>
                    <button type="button" className={activeTab === 'border' ? 'active' : ''} onClick={() => setActiveTab('border')}>Border</button>
                </>
            )}
            <button type="button" className={activeTab === 'effects' ? 'active' : ''} onClick={() => setActiveTab('effects')}>Effects</button>
          </div>
          <div className="popover-content">
            {activeTab === 'text' && renderTextTab()}
            {activeTab === 'fill' && renderFillTab()}
            {activeTab === 'border' && renderBorderTab()}
            {activeTab === 'line' && renderLineTab()}
            {activeTab === 'effects' && renderEffectsTab()}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
