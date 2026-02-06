import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import * as fsSync from 'fs';
import * as path from 'path';

// Try to import 'canvas' (native module) but tolerate it not being installed
let createCanvas: any = null;
let registerFont: any = null;
try {
  // require at runtime; if build failed during npm install, this will throw only at runtime (not during npm install)
  // but we still make the package optional in package.json so install won't try to build it.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const canvasLib: any = require('canvas');
  createCanvas = canvasLib.createCanvas;
  registerFont = canvasLib.registerFont;
} catch (err) {
  // Canvas native bindings not available — we'll fall back to estimations for text metrics.
  console.log('processor: optional dependency "canvas" not available; using fallback text metrics');
  createCanvas = null;
  registerFont = null;
}

const FONT_CONFIG = require('../../font-config.json');
const FONT_BASE_PATH = path.resolve(__dirname, '../fonts');

interface Component {
  id: string;
  type: string;
  position: { x: number; y: number };
  width: number;
  height: number;
  data: any;
}

interface VideoData {
  nodes: Component[];
  video_width: number;
  video_height: number;
  video_duration: number;
  canvas_width?: number;
  canvas_height?: number;
}

import { config } from './config';

export class VideoProcessor {
  constructor(
    private jobId: string,
    private videoPath: string,
    private outputPath: string,
    private videoData: VideoData
  ) {}

  // When we render text to PNG overlays, we'll collect them here for `process()` to wire into ffmpeg.
  private overlays: { file: string; x: number; y: number; enable: string }[] = [];

  // Render a text component into a PNG using node-canvas. Returns absolute path to PNG file.
  private createTextOverlay(
    id: string,
    lines: string[],
    fontSpec: string,
    fontFamilyForCanvas: string,
    fontFile: string,
    containerW: number,
    containerH: number,
    styles: any
  ): string | null {
    if (!createCanvas) return null;
    try {
      // ensure output dir exists
      const outDir = path.join(config.outputDir, this.jobId, 'overlays');
      if (!fsSync.existsSync(outDir)) fsSync.mkdirSync(outDir, { recursive: true });

      // create canvas sized to the component container (video pixels)
      const canvas = createCanvas(Math.max(1, containerW), Math.max(1, containerH));
      const ctx = canvas.getContext('2d');

      // Clear transparent
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Background fill if requested
      if (styles.fillType && styles.fillType !== 'none' && styles.fillColor && styles.fillColor !== 'transparent') {
        if (styles.fillType === 'gradient' || styles.fillType === 'radial') {
          // simple linear gradient top->bottom
          const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
          g.addColorStop(0, styles.gradientColor1 || '#ffffff');
          g.addColorStop(1, styles.gradientColor2 || '#000000');
          ctx.fillStyle = g;
        } else {
          ctx.fillStyle = styles.fillColor || '#ffffff';
        }
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // Setup font and alignment
      ctx.font = fontSpec;
      ctx.textBaseline = 'alphabetic';
      if (styles.textAlign === 'center') ctx.textAlign = 'center';
      else if (styles.textAlign === 'right') ctx.textAlign = 'right';
      else ctx.textAlign = 'left';

      // Shadow
      if (styles.hasShadow) {
        ctx.shadowColor = styles.shadowColor || '#000000';
        ctx.shadowBlur = parseFloat(styles.shadowBlur as any) || 4;
        ctx.shadowOffsetX = parseFloat(styles.shadowOffsetX as any) || 2;
        ctx.shadowOffsetY = parseFloat(styles.shadowOffsetY as any) || 2;
      } else {
        ctx.shadowColor = 'rgba(0,0,0,0)';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      }

      // fill style
      ctx.fillStyle = styles.fontColor || '#000000';

      // measure ascent from a representative character
      const sample = 'Mg';
      let ascent = Math.round((ctx.measureText(sample).actualBoundingBoxAscent) || (parseInt(String(fontSpec).match(/(\d+)px/)?.[1] || '16') * 0.8));

      // draw each line; place first baseline at ascent
      const lineHeight = Math.round((parseInt(String(fontSpec).match(/(\d+)px/)?.[1] || '16', 10) * 1.2));
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const tx = (styles.textAlign === 'center') ? Math.round(canvas.width / 2) : (styles.textAlign === 'right' ? canvas.width : 0);
        const ty = ascent + i * lineHeight;
        ctx.fillText(line, tx, ty);
      }

      const outPath = path.join(outDir, `${id}.png`);
      const buffer = canvas.toBuffer('image/png');
      fsSync.writeFileSync(outPath, buffer);
      return outPath;
    } catch (e) {
      console.log('createTextOverlay failed:', String(e));
      return null;
    }
  }

  private calculateVisibilityWindows(timestamps: number[], duration: number): [number, number][] {
    // If no timestamps are provided, default to visible for the whole duration
    if (!timestamps || timestamps.length === 0) return [[0, duration]];

    const sorted = [...timestamps].sort((a, b) => a - b);
    const windows: [number, number][] = [];

    for (let i = 0; i < sorted.length; i += 2) {
      const start = sorted[i];
      const end = sorted[i + 1] !== undefined ? sorted[i + 1] : duration;
      // allow zero-length windows (start === end) so enable can use gte(t,start)
      if (typeof start === 'number' && typeof end === 'number' && end >= start) {
        windows.push([start, end]);
      }
    }

    // If no valid windows were formed (e.g. malformed timestamps), fallback to full-duration
    if (windows.length === 0) return [[0, duration]];

    return windows;
  }

  private generateFilters(): string[] {
    const filters: string[] = [];
    
    const videoWidth = this.videoData.video_width;
    const videoHeight = this.videoData.video_height;
    const canvasWidth = this.videoData.canvas_width || (this.videoData as any).canvasWidth || videoWidth;
    const canvasHeight = this.videoData.canvas_height || (this.videoData as any).canvasHeight || videoHeight;

    // Allow frontend to send the actual DOM/video element size (video_node_width/height).
    // If present, scale coordinates from that browser-rendered size to actual video resolution.
    const videoNodeWidth = (this.videoData as any).video_node_width || (this.videoData as any).videoNodeWidth || canvasWidth;
    const videoNodeHeight = (this.videoData as any).video_node_height || (this.videoData as any).videoNodeHeight || canvasHeight;

    const scaleX = videoNodeWidth === videoWidth ? 1 : videoWidth / videoNodeWidth;
    const scaleY = videoNodeHeight === videoHeight ? 1 : videoHeight / videoNodeHeight;

    console.log(`Canvas ${canvasWidth}x${canvasHeight} -> Video ${videoWidth}x${videoHeight}, scale=(${scaleX.toFixed(3)}, ${scaleY.toFixed(3)})`);
    
    // Sort nodes by zIndex if available
    const sortedNodes = [...this.videoData.nodes].sort((a, b) => {
      const zA = (a.data as any).zIndex || 0;
      const zB = (b.data as any).zIndex || 0;
      return zA - zB;
    });

    console.log(`generateFilters(): nodes count=${sortedNodes.length}`);

    const hasGradient = sortedNodes.some(n =>
      (n.type === 'rectangle' || n.type === 'circle') && (n.data.styles?.fillType === 'gradient' || n.data.styles?.fillType === 'radial')
    );

    // Use rgba (Packed RGB with Alpha) for gradient processing.
    // This ensures alpha channel is available for blending (shadows, opacity)
    // and works with geq (component-wise) and drawtext/drawbox.
    if (hasGradient) {
      filters.push('format=rgba');
    }
    
    for (const component of sortedNodes) {
      const { type, position, width, height, data } = component;
      
      if (data.visible === false) {
        console.log(`Skipping component ${component.id} because visible=false`);
        continue;
      }

      const timestamps = data.timestamps || [];
      const styles = data.styles || {};
      const windows = this.calculateVisibilityWindows(timestamps, this.videoData.video_duration);
      
      // Log detailed info for debugging
      console.log(`Component ${component.id} (${type}) -> position=(${position.x},${position.y}) size=(${width}x${height}) windows=${JSON.stringify(windows)} styles=${JSON.stringify(styles)}`);

      console.log(`Component ${component.id} (${type}): fillType=${styles.fillType}, fillColor=${styles.fillColor}, text=${data.text}`);
      
      // Convert positions/sizes to pixels. Frontend may send percentages (0-100)
      // when `use_percentages` is true. Detect that and convert using video dimensions.
      let x: number;
      let y: number;
      let w: number;
      let h: number;

      const usePercentages = !!(this.videoData as any).use_percentages;

      const toPxX = (val: any) => {
        const n = parseFloat(val as any);
        if (isNaN(n)) return 0;
        if (usePercentages) return Math.round((n / 100) * videoWidth);
        return Math.round(n * scaleX);
      };
      const toPxY = (val: any) => {
        const n = parseFloat(val as any);
        if (isNaN(n)) return 0;
        if (usePercentages) return Math.round((n / 100) * videoHeight);
        return Math.round(n * scaleY);
      };

      x = toPxX(position.x);
      y = toPxY(position.y);
      // width/height percent values are relative to canvas width/height respectively
      w = toPxX(width);
      h = toPxY(height);

      if (type === 'rectangle' || type === 'circle') {
        filters.push(...this.generateShapeFilters(x, y, w, h, styles, windows, scaleX, scaleY));
      } else if (type === 'text') {
        filters.push(...this.generateTextFilters(x, y, { ...data, width: w, height: h }, styles, windows, scaleX, scaleY));
      } else if (type === 'line') {
        filters.push(...this.generateLineFilters(data, styles, windows, scaleX, scaleY));
      }
    }

    if (hasGradient) {
      filters.push('format=yuv420p');
    }
    
    return filters;
  }

  private generateShapeFilters(
    x: number, y: number, w: number, h: number,
    styles: any, windows: [number, number][], scaleX: number, scaleY: number
  ): string[] {
    const filters: string[] = [];
    
    if (windows.length === 0 || w <= 0 || h <= 0) return filters;
    
    console.log(`generateShapeFilters(): x=${x} y=${y} w=${w} h=${h} styles=${JSON.stringify(styles)} windows=${JSON.stringify(windows)}`);

    const enableConditions = windows.map(([start, end]) => {
      const s = start.toFixed(3);
      const e = end.toFixed(3);
      return start === end ? `gte(t,${s})` : `between(t,${s},${e})`;
    }).join('+');
    
    const rgbToHex = (color: string) => {
      if (color.startsWith('rgb')) {
        const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (match) {
          return `0x${parseInt(match[1]).toString(16).padStart(2, '0')}${parseInt(match[2]).toString(16).padStart(2, '0')}${parseInt(match[3]).toString(16).padStart(2, '0')}`;
        }
      }
      if (color.startsWith('#')) {
        return `0x${color.slice(1)}`;
      }
      return color === 'transparent' ? null : `0x${color}`;
    };
    
    const opacity = parseFloat(styles.opacity) || 1.0;
    const alpha = Math.round(opacity * 255).toString(16).padStart(2, '0');
    
    // Shadow (approximate blur by emitting multiple expanded drawboxes with decreasing alpha)
    if (styles.hasShadow) {
      const rawShadowColor = styles.shadowColor || '#000000';
      const shadowColorHex = rgbToHex(rawShadowColor);
      if (shadowColorHex) {
        const offsetX = Math.round((parseFloat(styles.shadowOffsetX) || 0) * scaleX);
        const offsetY = Math.round((parseFloat(styles.shadowOffsetY) || 0) * scaleY);
        const baseX = x + offsetX;
        const baseY = y + offsetY;
        const shadowBlur = Math.min(12, Math.max(0, Math.round(parseFloat(styles.shadowBlur as any) || 4)));
        const steps = Math.max(1, Math.min(6, Math.ceil(shadowBlur / 2)));
        const baseOpacity = Math.max(0, Math.min(1, parseFloat(styles.shadowOpacity as any) || 0.5));

        for (let i = 0; i < steps; i++) {
          // expand box by i pixels (scaled) to approximate blur spread
          const expand = i; // pixels
          const sx = baseX - expand;
          const sy = baseY - expand;
          const sw = w + expand * 2;
          const sh = h + expand * 2;
          const alpha = Math.round(baseOpacity * 255 * (1 - i / (steps + 1)));
          const alphaHex = alpha.toString(16).padStart(2, '0');
          filters.push(`drawbox=x=${sx}:y=${sy}:w=${sw}:h=${sh}:color=${shadowColorHex}${alphaHex}:t=fill:enable='${enableConditions}'`);
        }
      }
    }
    
    // Fill
    if (styles.fillType === 'gradient') {
      const c1 = this.parseColor(styles.gradientColor1 || '#ffffff');
      const c2 = this.parseColor(styles.gradientColor2 || '#000000');
      
      if (c1 && c2) {
        // Vertical gradient interpolation
        const rExpr = `(((${c1.r} * (${h} - (Y - ${y})) + ${c2.r} * (Y - ${y})) / ${h}) * ${opacity} + p(X,Y) * (1 - ${opacity}))`;
        const gExpr = `(((${c1.g} * (${h} - (Y - ${y})) + ${c2.g} * (Y - ${y})) / ${h}) * ${opacity} + p(X,Y) * (1 - ${opacity}))`;
        const bExpr = `(((${c1.b} * (${h} - (Y - ${y})) + ${c2.b} * (Y - ${y})) / ${h}) * ${opacity} + p(X,Y) * (1 - ${opacity}))`;
        
        // For rgba format:
        // r (Component 0) -> Red
        // g (Component 1) -> Green
        // b (Component 2) -> Blue
        // a (Component 3) -> Alpha
        filters.push(`geq=r='if(between(X,${x},${x+w})*between(Y,${y},${y+h}),${rExpr},p(X,Y))':` +
                     `g='if(between(X,${x},${x+w})*between(Y,${y},${y+h}),${gExpr},p(X,Y))':` +
                     `b='if(between(X,${x},${x+w})*between(Y,${y},${y+h}),${bExpr},p(X,Y))':` +
                     `a='p(X,Y)':enable='${enableConditions}'`);
      }
    } else if (styles.fillType === 'radial') {
      // Implement radial gradient using geq:
      const c1 = this.parseColor(styles.gradientColor1 || '#ffffff');
      const c2 = this.parseColor(styles.gradientColor2 || '#000000');
      if (c1 && c2) {
        // center and maximum radius
        const cx = x + w / 2;
        const cy = y + h / 2;
        const maxR = Math.sqrt((w / 2) * (w / 2) + (h / 2) * (h / 2));

        // compute interpolated channel expressions and blend with existing pixels by opacity
        const a1r = c1.r;
        const a1g = c1.g;
        const a1b = c1.b;
        const a2r = c2.r;
        const a2g = c2.g;
        const a2b = c2.b;

        // Use hypot(X-cx\,Y-cy) to compute distance -> need to escape commas for ffmpeg expression
        const rExpr = `(${a1r}+(${a2r}-${a1r})*min(hypot(X-${cx}\\,Y-${cy})/${maxR}\\,1))`;
        const gExpr = `(${a1g}+(${a2g}-${a1g})*min(hypot(X-${cx}\\,Y-${cy})/${maxR}\\,1))`;
        const bExpr = `(${a1b}+(${a2b}-${a1b})*min(hypot(X-${cx}\\,Y-${cy})/${maxR}\\,1))`;

        // Build geq expression that writes r,g,b while preserving original alpha and blending by opacity
        filters.push(
          `geq=` +
          `r='if(between(X,${x},${x+w})*between(Y,${y},${y+h}),r(X,Y)*(1-${opacity})+(${rExpr})*${opacity},r(X,Y))':` +
          `g='if(between(X,${x},${x+w})*between(Y,${y},${y+h}),g(X,Y)*(1-${opacity})+(${gExpr})*${opacity},g(X,Y))':` +
          `b='if(between(X,${x},${x+w})*between(Y,${y},${y+h}),b(X,Y)*(1-${opacity})+(${bExpr})*${opacity},b(X,Y))':` +
          `a='p(X,Y)':enable='${enableConditions}'`
        );
      }
    } else {
      const fillColor = rgbToHex(styles.fillColor || '#ffffff');
      if (fillColor) {
        filters.push(`drawbox=x=${x}:y=${y}:w=${w}:h=${h}:color=${fillColor}${alpha}:t=fill:enable='${enableConditions}'`);
      }
    }
    
    // Border
    const borderWidth = Math.round((parseFloat(styles.borderWidth) || 0) * Math.min(scaleX, scaleY));
    if (borderWidth > 0) {
      const borderColor = rgbToHex(styles.borderColor || '#000000');
      if (borderColor) {
        filters.push(`drawbox=x=${x}:y=${y}:w=${w}:h=${h}:color=${borderColor}:t=${borderWidth}:enable='${enableConditions}'`);
      }
    }
    
    return filters;
  }

  private generateTextFilters(
    x: number, y: number, data: any, styles: any, windows: [number, number][], scaleX: number, scaleY: number
  ): string[] {
    const filters: string[] = [];
    const rawText = data.text || 'Text';
    // We'll wrap text to the container width (in video pixels) so that FFmpeg drawtext matches the WYSIWYG.
    // If the frontend already included explicit newlines, respect them but still reflow each paragraph.
    const paragraphs = rawText.split('\n');

    // Helper: wrap a single paragraph into lines that fit within maxWidth (px) using canvas measurement if available.
    const wrapParagraph = (para: string, maxWidth: number, ctx: any, fontSpec: string) => {
      if (!para || maxWidth <= 0) return [''];
      // If we have a canvas context, use accurate measureText
      if (ctx && typeof ctx.measureText === 'function') {
        ctx.font = fontSpec;
        const words = para.split(/\s+/);
        const lines: string[] = [];
        let current = '';
        for (let i = 0; i < words.length; i++) {
          const w = words[i];
          const test = current ? (current + ' ' + w) : w;
          const m = ctx.measureText(test);
          const width = (m && typeof m.width === 'number') ? m.width : (test.length * parseInt(fontSpec, 10));
          if (width <= maxWidth) {
            current = test;
          } else {
            if (current) lines.push(current);
            current = w;
          }
        }
        if (current) lines.push(current);
        return lines;
      }

      // Fallback: approximate characters per line using average char width (fontSize * 0.6)
      const fontSizeFallback = parseInt(String(fontSpec).match(/(\d+)px/)?.[1] || '12', 10);
      const approxCharWidth = fontSizeFallback * 0.6;
      const approxChars = Math.max(1, Math.floor(maxWidth / approxCharWidth));
      const regex = new RegExp(`(.{1,${approxChars}})(?:\\s+|$)`, 'g');
      const out: string[] = [];
      let match: RegExpExecArray | null;
      let start = 0;
      const words = para.split(/\s+/);
      let cur = '';
      for (const w of words) {
        if ((cur + ' ' + w).trim().length <= approxChars) {
          cur = cur ? (cur + ' ' + w) : w;
        } else {
          if (cur) out.push(cur);
          cur = w;
        }
      }
      if (cur) out.push(cur);
      return out;
    };

    // Build font spec string used for measurement (px on video)
    // Compute later to know fontSize variable; for now lines will be computed after fontSize is resolved.
    // Bring necessary sizes into scope
    const videoWidth = this.videoData.video_width;
    const canvasWidth = (this.videoData as any).canvas_width || (this.videoData as any).canvasWidth || videoWidth;
    const usePercentages = !!(this.videoData as any).use_percentages;

    let lines: string[] = [];

    // Resolve font size:
    // - If frontend provides a percentage string like '13.9%', interpret it as percent of the canvas width.
    // - If frontend provided numbers but indicated use_percentages, treat that number as percent value (0-100).
    // - Otherwise treat numeric font sizes as pixels authored on canvas and scale by scaleY.
    let fontSize: number;
    if (typeof styles.fontSize === 'string' && styles.fontSize.trim().endsWith('%')) {
      const pct = parseFloat(styles.fontSize);
      // fontSize currently in canvas (DOM) pixels
      const fontPxOnCanvas = Math.max(1, (pct / 100) * canvasWidth);
      // convert to video pixels using horizontal scale
      fontSize = Math.max(1, Math.round(fontPxOnCanvas * scaleX));
    } else {
      const raw = parseFloat(styles.fontSize as any);
      if (!isNaN(raw) && usePercentages) {
        // numeric percent value -> percent of canvas width
        const fontPxOnCanvas = Math.max(1, (raw / 100) * canvasWidth);
        fontSize = Math.max(1, Math.round(fontPxOnCanvas * scaleX));
      } else {
        const fallback = isNaN(raw) ? 16 : raw;
        // numeric px values are assumed to be canvas px authored; scale vertically
        fontSize = Math.max(1, Math.round(fallback * scaleY));
      }
    }

    let fontColor = styles.fontColor || '#000000';
    
    // Handle gradient text
    if (styles.textFillType === 'gradient' || styles.textFillType === 'radial') {
      const color1 = styles.textGradientColor1 || '#ffffff';
      
      if (color1.startsWith('rgb')) {
        const match = color1.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (match) {
          fontColor = `#${parseInt(match[1]).toString(16).padStart(2, '0')}${parseInt(match[2]).toString(16).padStart(2, '0')}${parseInt(match[3]).toString(16).padStart(2, '0')}`;
        }
      } else {
        fontColor = color1;
      }
    }
    
    if (fontColor.startsWith('rgb')) {
      const match = fontColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (match) {
        fontColor = `#${parseInt(match[1]).toString(16).padStart(2, '0')}${parseInt(match[2]).toString(16).padStart(2, '0')}${parseInt(match[3]).toString(16).padStart(2, '0')}`;
      }
    }
    
    const fontFamily = styles.fontFamily || 'Arial';
    const isBold = styles.isBold || false;
    const isItalic = styles.isItalic || false;
    
    const fontVariant = isBold && isItalic ? 'boldItalic' : isBold ? 'bold' : isItalic ? 'italic' : 'regular';
    const fontRelPath = FONT_CONFIG[fontFamily]?.[fontVariant] || FONT_CONFIG['Arial']['regular'];
    const fontFile = path.resolve(FONT_BASE_PATH, fontRelPath);

    // Log font resolution and existence
    try {
      const exists = fsSync.existsSync(fontFile);
      console.log(`generateTextFilters(): font resolved for '${fontFamily}' variant='${fontVariant}' -> ${fontFile} exists=${exists}`);
    } catch (err) {
      console.log(`generateTextFilters(): error checking font file ${fontFile}: ${String(err)}`);
    }

    // prepare the canvas font family name used for registerFont and ctx.font
    const fontFamilyForCanvas = `${fontFamily.replace(/\s+/g, '_')}_${fontVariant}`;
    const fontSpec = `${fontSize}px "${fontFamilyForCanvas || fontFamily}"`;

    const textAlign = styles.textAlign || 'left';
    const lineHeight = Math.round(fontSize * 1.2);
    const containerWidth = data.width;
    const containerHeight = data.height;
    
    if (windows.length === 0) return filters;
    
    const enableConditions = windows.map(([start, end]) => {
      const s = start.toFixed(3);
      const e = end.toFixed(3);
      return start === end ? `gte(t,${s})` : `between(t,${s},${e})`;
    }).join('+');

    console.log(`generateTextFilters(): x=${x} y=${y} container=${containerWidth}x${containerHeight} fontSize=${fontSize} enable='${enableConditions}'`);

    // Add background only if explicitly set and not transparent
    if (styles.fillType && styles.fillType !== 'none' && styles.fillColor && styles.fillColor !== 'transparent' && containerWidth && containerHeight) {
      const bgFilters = this.generateShapeFilters(x, y, containerWidth, containerHeight, styles, windows, scaleX, scaleY);
      filters.push(...bgFilters);
    }
    
    // Register font (if available) before measuring/wrapping
    try {
      if (fsSync.existsSync(fontFile) && registerFont) {
        // registerFont will throw if registration fails; ignore failures
        try {
          registerFont(fontFile, { family: fontFamilyForCanvas });
        } catch (e) {
          console.log(`registerFont failed for ${fontFile}: ${String(e)}`);
        }
      }
    } catch (e) {
      // ignore
    }

    // create a canvas context to measure text ascent and widths so we can convert top-based y to ffmpeg baseline y and wrap
    let canvasCtx: any = null;
    try {
      if (createCanvas) {
        const canvas = createCanvas(800, 200);
        canvasCtx = canvas.getContext('2d');
        // use the same font size (video pixels) for measurement. Use the registered family name if available.
        canvasCtx.font = fontSpec;
      }
    } catch (e) {
      canvasCtx = null;
    }

    // Now that fontSize and canvas context are ready, perform wrapping of paragraphs into `lines` if a container width exists
    if (containerWidth && containerWidth > 0) {
      try {
        for (const para of paragraphs) {
          const wrapped = wrapParagraph(para.trim(), containerWidth, canvasCtx, fontSpec);
          if (wrapped.length === 0) lines.push(''); else lines.push(...wrapped);
        }
      } catch (e) {
        lines = rawText.split('\n');
      }
    } else {
      lines = rawText.split('\n');
    }

    // Trim any empty trailing lines
    lines = lines.map(l => l.replace(/\s+$/,'')).filter((l,i) => !(l === '' && i === lines.length-1));

    // compute per-line baseline offset using canvas if possible

    // If we have node-canvas available, render the entire text block into one PNG overlay and add to overlays array.
    if (createCanvas) {
      try {
        // create overlay PNG for the whole block
        const overlayFile = this.createTextOverlay(data.id || `text_${Date.now()}`, lines, fontSpec, fontFamilyForCanvas, fontFile, containerWidth || 0, containerHeight || 0, styles);
        if (overlayFile) {
          // overlay x,y in video pixels; enable conditions as earlier
          const enable = enableConditions;
          const ox = Math.round(x);
          const oy = Math.round(y);
          this.overlays.push({ file: overlayFile, x: ox, y: oy, enable });
          // we don't emit drawtext filters for this component because we're overlaying an image instead
          return filters;
        }
      } catch (e) {
        console.log('create overlay failed, falling back to drawtext:', String(e));
      }
    }



    // Fallback: continue to emit drawtext filters per-line (existing behavior)

    lines.forEach((line: string, index: number) => {

      const text = line.replace(/'/g, "\\'").replace(/\\/g, '\\\\').replace(/:/g, '\\:').trim();

      if (!text) return;



      // Measure ascent/descent for this line so we can convert top-left y to ffmpeg drawtext y.

      let ascent = 0;

      let descent = 0;

      if (canvasCtx) {

        try {

          const metrics = canvasCtx.measureText(text);

          if (metrics) {
            if (typeof metrics.actualBoundingBoxAscent === 'number') ascent = Math.round(metrics.actualBoundingBoxAscent);
            else if (typeof metrics.fontBoundingBoxAscent === 'number') ascent = Math.round(metrics.fontBoundingBoxAscent);
            else ascent = Math.round(fontSize * 0.8);

            if (typeof metrics.actualBoundingBoxDescent === 'number') descent = Math.round(metrics.actualBoundingBoxDescent);
            else if (typeof metrics.fontBoundingBoxDescent === 'number') descent = Math.round(metrics.fontBoundingBoxDescent || fontSize * 0.2);
            else descent = Math.round(fontSize * 0.2);
          } else {
            ascent = Math.round(fontSize * 0.8);
            descent = Math.round(fontSize * 0.2);
          }
        } catch (e) {
          ascent = Math.round(fontSize * 0.8);
          descent = Math.round(fontSize * 0.2);
        }
      } else {
        ascent = Math.round(fontSize * 0.8);
        descent = Math.round(fontSize * 0.2);
      }

      const yMode = (this.videoData as any).ffmpeg_text_y_mode || (this.videoData as any).ffmpegTextYMode || 'baseline';
      const rawOffset = (this.videoData as any).ffmpeg_text_y_offset ?? (this.videoData as any).ffmpegTextYOffset;
      const offsetNum = typeof rawOffset === 'string' ? parseFloat(rawOffset) : rawOffset;
      // Compute total block height and a top-of-block (topMost) so we can align 'top' and 'middle' precisely
      const totalHeight = lines.length * lineHeight;
      let topMost = (typeof containerHeight === 'number' && containerHeight > 0) ? y : y; // default top
      if (typeof containerHeight === 'number' && containerHeight > 0) {
        if (yMode === 'middle') {
          topMost = y + Math.round((containerHeight - totalHeight) / 2);
        } else if (yMode === 'top') {
          topMost = y; // align to top
        } else {
          // baseline mode: assume y is top of container; keep topMost = y
          topMost = y;
        }
      } else {
        topMost = y;
      }

      let yPos: number;
      if (typeof offsetNum === 'number' && !Number.isNaN(offsetNum)) {
        // numeric offset in [0,1] interpolates between topMost (0) and topMost+ascent (1)
        const clamped = Math.max(0, Math.min(1, offsetNum));
        yPos = topMost + Math.round(ascent * clamped) + (index * lineHeight);
      } else {
        // baseline anchored at topMost + ascent
        yPos = topMost + ascent + (index * lineHeight);
      }

      console.log(`text metrics: text='${text}' fontSize=${fontSize} ascent=${ascent} descent=${descent} yMode=${yMode} computedY=${yPos}`);

      if (styles.hasShadow) {
        const rawShadowColor = styles.shadowColor || '#000000';
        const shadowOpacity = Math.max(0, Math.min(1, parseFloat(styles.shadowOpacity as any) || 0.6));
        const shadowBlur = Math.max(0, Math.round(parseFloat(styles.shadowBlur as any) || 4));
        const baseOffsetX = Math.round((parseFloat(styles.shadowOffsetX) || 2) * scaleX);
        const baseOffsetY = Math.round((parseFloat(styles.shadowOffsetY) || 2) * scaleY);

        const steps = Math.max(1, Math.min(8, Math.ceil(shadowBlur / 2)));
        for (let i = 0; i < steps; i++) {
          const spread = i; // pixels away from center
          const alpha = Math.round(shadowOpacity * 255 * (1 - i / (steps + 1))).toString(16).padStart(2, '0');
          const colorHex = (() => {
            const c = this.parseColor(rawShadowColor) || { r: 0, g: 0, b: 0 };
            return `#${c.r.toString(16).padStart(2,'0')}${c.g.toString(16).padStart(2,'0')}${c.b.toString(16).padStart(2,'0')}`;
          })();

          let sx = x + baseOffsetX + spread;
          let sy = yPos + baseOffsetY + spread;
          if (i % 2 === 1) { sx = x + baseOffsetX - spread; sy = yPos + baseOffsetY - spread; }

          let shadowFilter = `drawtext=text='${text}':fontfile='${fontFile}':fontsize=${fontSize}:fontcolor=${colorHex}${alpha}:box=0`;
          if (textAlign === 'center') {
            shadowFilter += `:x=${sx + containerWidth / 2}-text_w/2:y=${sy}`;
          } else if (textAlign === 'right') {
            shadowFilter += `:x=${sx + containerWidth}-text_w:y=${sy}`;
          } else {
            shadowFilter += `:x=${sx}:y=${sy}`;
          }
          shadowFilter += `:enable='${enableConditions}'`;
          filters.push(shadowFilter);
        }
      }

      let textFilter = `drawtext=text='${text}':fontfile='${fontFile}':fontsize=${fontSize}:fontcolor=${fontColor}:box=0`;

      if (textAlign === 'center') {
        textFilter += `:x=${x + containerWidth / 2}-text_w/2:y=${yPos}`;
      } else if (textAlign === 'right') {
        textFilter += `:x=${x + containerWidth}-text_w:y=${yPos}`;
      } else {
        textFilter += `:x=${x}:y=${yPos}`;
      }

      textFilter += `:enable='${enableConditions}'`;
      filters.push(textFilter);
    });

     return filters;
   }

  private generateLineFilters(data: any, styles: any, windows: [number, number][], scaleX: number, scaleY: number): string[] {
    const filters: string[] = [];
    const startPoint = data.startPoint || { x: 0, y: 0 };
    const endPoint = data.endPoint || { x: 100, y: 0 };
    const color = (styles.borderColor || '#ffffff').replace('#', '0x');
    const width = Math.round((parseFloat(styles.borderWidth) || 2) * Math.min(scaleX, scaleY));

    const x1 = Math.round((parseFloat(startPoint.x) || 0) * scaleX);
    const y1 = Math.round((parseFloat(startPoint.y) || 0) * scaleY);
    const x2 = Math.round((parseFloat(endPoint.x) || 0) * scaleX);
    const y2 = Math.round((parseFloat(endPoint.y) || 0) * scaleY);

    if (windows.length === 0) return filters;

    const enableConditions = windows.map(([start, end]) => {
      const s = start.toFixed(3);
      const e = end.toFixed(3);
      return start === end ? `gte(t,${s})` : `between(t,${s},${e})`;
    }).join('+');

    console.log(`generateLineFilters(): start=(${startPoint.x},${startPoint.y}) end=(${endPoint.x},${endPoint.y}) width=${width} enable='${enableConditions}'`);
    const lineFilter = `drawline=x1=${x1}:y1=${y1}:x2=${x2}:y2=${y2}:color=${color}:t=${width}:enable='${enableConditions}'`;
    filters.push(lineFilter);

    return filters;
  }

  private parseColor(color: string): { r: number, g: number, b: number } | null {
    if (!color || color === 'transparent') return null;

    if (color.startsWith('rgb')) {
      const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (match) {
        return {
          r: parseInt(match[1]),
          g: parseInt(match[2]),
          b: parseInt(match[3])
        };
      }
    }

    if (color.startsWith('#')) {
      const hex = color.slice(1);
      if (hex.length === 3) {
        return {
          r: parseInt(hex[0] + hex[0], 16),
          g: parseInt(hex[1] + hex[1], 16),
          b: parseInt(hex[2] + hex[2], 16)
        };
      }
      if (hex.length === 6) {
        return {
          r: parseInt(hex.slice(0, 2), 16),
          g: parseInt(hex.slice(2, 4), 16),
          b: parseInt(hex.slice(4, 6), 16)
        };
      }
    }
    return { r: 0, g: 0, b: 0 };
  }

  async process(): Promise<{ success: boolean; result: string }> {
    try {
      console.log('VideoProcessor.process() called');
      console.log('Video data:', JSON.stringify(this.videoData).substring(0, 200));

      const filters = this.generateFilters();
      console.log('Filters generated, count:', filters.length);

      if (filters.length === 0) {
        console.log('No filters, copying video as-is');
        const args = ['-i', this.videoPath, '-c', 'copy', '-y', this.outputPath];
        return await this.runFFmpeg(args);
      }

      const filterString = filters.join(',');
      console.log('Filter string length:', filterString.length);
      console.log('Filter string:', filterString);

      const args = [
        '-i', this.videoPath,
        '-vf', filterString,
        '-c:v', 'libx264',
        '-preset', 'slow',
        '-crf', '18',
        '-c:a', 'copy',
        '-y', this.outputPath
      ];

      return await this.runFFmpeg(args);
    } catch (error: any) {
      console.error('Error in process():', error);
      return { success: false, result: `Processing error: ${error.message}` };
    }
  }

  private async runFFmpeg(args: string[]): Promise<{ success: boolean; result: string }> {
    console.log('FFmpeg args count:', args.length);
    const progressPath = path.join(config.outputDir, this.jobId, `${this.jobId}_progress.txt`);
    console.log('Progress path:', progressPath);

    try {
      await fs.writeFile(progressPath, '');
      console.log('Progress file created');
    } catch (err) {
      console.error('Failed to create progress file:', err);
    }

    return new Promise((resolve) => {
      const fullCmd = `ffmpeg ${args.map(a => a.includes(' ') ? `'${a}'` : a).join(' ')} -progress pipe:1`;
      console.log('Running ffmpeg:', fullCmd);

      const ffmpeg = spawn('ffmpeg', [...args, '-progress', 'pipe:1']);
      console.log('Spawned ffmpeg pid=', ffmpeg.pid);
      let stderr = '';
      let lastProgressWrite = 0;

      ffmpeg.stdout.on('data', (data) => {
        const str = data.toString();
        // also print progress lines for debugging
        console.log('[ffmpeg stdout]', str.trim());
        const lines = str.split('\n').filter((l: string) => l.trim());
        const timeMatch = lines.find((l: string) => l.startsWith('out_time_ms='));
        if (timeMatch) {
          const now = Date.now();
          if (now - lastProgressWrite > 200) {
            fs.writeFile(progressPath, timeMatch).catch(() => {});
            lastProgressWrite = now;
          }
        }
      });

      ffmpeg.stderr.on('data', (data) => {
        const s = data.toString();
        stderr += s;
        // realtime stderr log
        console.log('[ffmpeg stderr]', s.trim());
      });

      ffmpeg.on('close', (code) => {
        fs.unlink(progressPath).catch(() => {});
        console.log('ffmpeg exited with code=', code);
        if (code === 0) {
          resolve({ success: true, result: this.outputPath });
        } else {
          console.error('FFmpeg failed with code:', code);
          console.error('FFmpeg stderr (collected):', stderr);
          resolve({ success: false, result: `FFmpeg error: ${stderr}` });
        }
      });

      ffmpeg.on('error', (err) => {
        fs.unlink(progressPath).catch(() => {});
        console.error('ffmpeg process error:', err);
        resolve({ success: false, result: `Process error: ${err.message}` });
      });
    });
  }
}



