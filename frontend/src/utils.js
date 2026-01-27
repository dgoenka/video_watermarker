// utils.js

export const getBackgroundStyle = (styles) => {
    if (!styles) return 'transparent';
    
    if (styles.fillType === 'gradient') {
      const angle = styles.gradientAngle || styles.textGradientAngle || 0;
      return `linear-gradient(${angle}deg, ${styles.gradientColor1 || styles.textGradientColor1}, ${styles.gradientColor2 || styles.textGradientColor2})`;
    } else if (styles.fillType === 'radial') {
      return `radial-gradient(circle, ${styles.gradientColor1 || styles.textGradientColor1}, ${styles.gradientColor2 || styles.textGradientColor2})`;
    }
    return styles.fillColor;
};
