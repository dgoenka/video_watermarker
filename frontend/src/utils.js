// utils.js

export const getBackgroundStyle = (styles) => {
    if (!styles) return 'transparent';
    
    if (styles.fillType === 'gradient') {
      return `linear-gradient(${styles.gradientAngle}deg, ${styles.gradientColor1}, ${styles.gradientColor2})`;
    } else if (styles.fillType === 'radial') {
      return `radial-gradient(circle, ${styles.gradientColor1}, ${styles.gradientColor2})`;
    }
    return styles.fillColor;
};
