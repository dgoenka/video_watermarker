import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';

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

  private calculateVisibilityWindows(timestamps: number[], duration: number): [number, number][] {
    if (!timestamps || timestamps.length === 0) return [];
    
    const sorted = [...timestamps].sort((a, b) => a - b);
    const windows: [number, number][] = [];
    
    for (let i = 0; i < sorted.length; i += 2) {
      const start = sorted[i];
      const end = sorted[i + 1] !== undefined ? sorted[i + 1] : duration;
      windows.push([start, end]);
    }
    
    return windows;
  }

  private generateFilters(): string[] {
    const filters: string[] = [];
    
    const videoWidth = this.videoData.video_width;
    const videoHeight = this.videoData.video_height;
    const canvasWidth = this.videoData.canvas_width || videoWidth;
    const canvasHeight = this.videoData.canvas_height || videoHeight;
    
    // No scaling needed if canvas and video dimensions match
    const scaleX = canvasWidth === videoWidth ? 1 : videoWidth / canvasWidth;
    const scaleY = canvasHeight === videoHeight ? 1 : videoHeight / canvasHeight;
    
    console.log(`Canvas ${canvasWidth}x${canvasHeight} -> Video ${videoWidth}x${videoHeight}, scale=(${scaleX.toFixed(3)}, ${scaleY.toFixed(3)})`);
    
    for (const component of this.videoData.nodes) {
      const { type, position, width, height, data } = component;
      const timestamps = data.timestamps || [];
      const styles = data.styles || {};
      const windows = this.calculateVisibilityWindows(timestamps, this.videoData.video_duration);
      
      console.log(`Component ${component.id} (${type}): fillType=${styles.fillType}, fillColor=${styles.fillColor}, text=${data.text}`);
      
      const x = Math.round(position.x * scaleX);
      const y = Math.round(position.y * scaleY);
      const w = Math.round(width * scaleX);
      const h = Math.round(height * scaleY);
      
      if (type === 'rectangle' || type === 'circle') {
        filters.push(...this.generateShapeFilters(x, y, w, h, styles, windows));
      } else if (type === 'text') {
        filters.push(...this.generateTextFilters(x, y, { ...data, width: w, height: h }, styles, windows, scaleX, scaleY));
      } else if (type === 'line') {
        filters.push(...this.generateLineFilters(data, styles, windows, scaleX, scaleY));
      }
    }
    
    return filters;
  }

  private generateShapeFilters(
    x: number, y: number, w: number, h: number,
    styles: any, windows: [number, number][]
  ): string[] {
    const filters: string[] = [];
    
    if (windows.length === 0) return filters;
    
    const enableConditions = windows.map(([start, end]) => {
      const s = start.toFixed(3);
      const e = end.toFixed(3);
      return start === end ? `gte(t,${s})` : `between(t,${s},${e})`;
    }).join('+');
    
    const rgbToHex = (color: string) => {
      if (color.startsWith('rgb')) {
        const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
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
    
    // Shadow
    if (styles.hasShadow) {
      const shadowColor = rgbToHex(styles.shadowColor || '#000000');
      if (shadowColor) {
        const shadowX = x + parseInt(styles.shadowOffsetX || 0);
        const shadowY = y + parseInt(styles.shadowOffsetY || 0);
        filters.push(`drawbox=x=${shadowX}:y=${shadowY}:w=${w}:h=${h}:color=${shadowColor}80:t=fill:enable='${enableConditions}'`);
      }
    }
    
    // Fill
    if (styles.fillType === 'gradient') {
      const color1 = rgbToHex(styles.gradientColor1 || '#ffffff');
      const color2 = rgbToHex(styles.gradientColor2 || '#000000');
      if (color1 && color2) {
        const angle = styles.gradientAngle || 0;
        const gradientFilter = `drawbox=x=${x}:y=${y}:w=${w}:h=${h}:color=${color1}${alpha}:t=fill:enable='${enableConditions}',` +
                              `drawbox=x=${x}:y=${y}:w=${w}:h=${h}:color=${color2}${alpha}:t=fill:enable='${enableConditions}'`;
        filters.push(gradientFilter);
      }
    } else if (styles.fillType === 'radial') {
      const color1 = rgbToHex(styles.gradientColor1 || '#ffffff');
      const color2 = rgbToHex(styles.gradientColor2 || '#000000');
      if (color1 && color2) {
        filters.push(`drawbox=x=${x}:y=${y}:w=${w}:h=${h}:color=${color1}${alpha}:t=fill:enable='${enableConditions}'`);
      }
    } else {
      const fillColor = rgbToHex(styles.fillColor || '#ffffff');
      if (fillColor) {
        filters.push(`drawbox=x=${x}:y=${y}:w=${w}:h=${h}:color=${fillColor}${alpha}:t=fill:enable='${enableConditions}'`);
      }
    }
    
    // Border
    const borderWidth = styles.borderWidth || 0;
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
    const lines = rawText.split('\n');
    const fontSize = Math.round((styles.fontSize || 16) * Math.min(scaleX, scaleY));
    let fontColor = styles.fontColor || '#000000';
    
    // Handle gradient text
    if (styles.textFillType === 'gradient' || styles.textFillType === 'radial') {
      const color1 = styles.textGradientColor1 || '#ffffff';
      
      if (color1.startsWith('rgb')) {
        const match = color1.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (match) {
          fontColor = `#${parseInt(match[1]).toString(16).padStart(2, '0')}${parseInt(match[2]).toString(16).padStart(2, '0')}${parseInt(match[3]).toString(16).padStart(2, '0')}`;
        }
      } else {
        fontColor = color1;
      }
    }
    
    if (fontColor.startsWith('rgb')) {
      const match = fontColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
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
    
    // Add background only if explicitly set and not transparent
    if (styles.fillType && styles.fillType !== 'none' && styles.fillColor && styles.fillColor !== 'transparent' && containerWidth && containerHeight) {
      const bgFilters = this.generateShapeFilters(x, y, containerWidth, containerHeight, styles, windows);
      filters.push(...bgFilters);
    }
    
    lines.forEach((line: string, index: number) => {
      const text = line.replace(/'/g, "'").replace(/\\/g, '\\\\').replace(/:/g, '\\:').trim();
      if (!text) return;
      
      // Adjust y position to account for text baseline
      const yPos = y + (index * lineHeight) + Math.round(fontSize * 0.8);
      
      if (styles.hasShadow) {
        const shadowOffsetX = Math.round((styles.shadowOffsetX || 2) * scaleX);
        const shadowOffsetY = Math.round((styles.shadowOffsetY || 2) * scaleY);
        const shadowColor = styles.shadowColor || '#000000';
        
        let shadowFilter = `drawtext=text='${text}':fontfile=${fontFile}:fontsize=${fontSize}:fontcolor=${shadowColor}80:box=0`;
        
        if (textAlign === 'center') {
          shadowFilter += `:x=${x + containerWidth / 2 + shadowOffsetX}-text_w/2:y=${yPos + shadowOffsetY}`;
        } else if (textAlign === 'right') {
          shadowFilter += `:x=${x + containerWidth + shadowOffsetX}-text_w:y=${yPos + shadowOffsetY}`;
        } else {
          shadowFilter += `:x=${x + shadowOffsetX}:y=${yPos + shadowOffsetY}`;
        }
        
        shadowFilter += `:enable='${enableConditions}'`;
        filters.push(shadowFilter);
      }
      
      let textFilter = `drawtext=text='${text}':fontfile=${fontFile}:fontsize=${fontSize}:fontcolor=${fontColor}:box=0`;
      
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
    const width = styles.borderWidth || 2;
    
    const x1 = Math.round(startPoint.x * scaleX);
    const y1 = Math.round(startPoint.y * scaleY);
    const x2 = Math.round(endPoint.x * scaleX);
    const y2 = Math.round(endPoint.y * scaleY);
    
    if (windows.length === 0) return filters;
    
    const enableConditions = windows.map(([start, end]) => {
      const s = start.toFixed(3);
      const e = end.toFixed(3);
      return start === end ? `gte(t,${s})` : `between(t,${s},${e})`;
    }).join('+');
    const lineFilter = `drawline=x1=${x1}:y1=${y1}:x2=${x2}:y2=${y2}:color=${color}:t=${width}:enable='${enableConditions}'`;
    filters.push(lineFilter);
    
    return filters;
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
      const ffmpeg = spawn('ffmpeg', [...args, '-progress', 'pipe:1']);
      let stderr = '';
      
      ffmpeg.stdout.on('data', (data) => {
        const lines = data.toString().split('\n').filter(l => l.trim());
        const timeMatch = lines.find(l => l.startsWith('out_time_ms='));
        if (timeMatch) {
          fs.writeFile(progressPath, timeMatch).catch(() => {});
        }
      });
      
      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      ffmpeg.on('close', (code) => {
        fs.unlink(progressPath).catch(() => {});
        if (code === 0) {
          resolve({ success: true, result: this.outputPath });
        } else {
          console.error('FFmpeg failed with code:', code);
          console.error('FFmpeg stderr:', stderr);
          resolve({ success: false, result: `FFmpeg error: ${stderr}` });
        }
      });
      
      ffmpeg.on('error', (err) => {
        fs.unlink(progressPath).catch(() => {});
        resolve({ success: false, result: `Process error: ${err.message}` });
      });
    });
  }
}
