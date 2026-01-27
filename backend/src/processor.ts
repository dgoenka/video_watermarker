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
    
    const scaleX = videoWidth / canvasWidth;
    const scaleY = videoHeight / canvasHeight;
    
    console.log(`Canvas ${canvasWidth}x${canvasHeight} -> Video ${videoWidth}x${videoHeight}, scale=(${scaleX.toFixed(3)}, ${scaleY.toFixed(3)})`);
    
    for (const component of this.videoData.nodes) {
      const { type, position, width, height, data } = component;
      const timestamps = data.timestamps || [];
      const styles = data.styles || {};
      const windows = this.calculateVisibilityWindows(timestamps, this.videoData.video_duration);
      
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
    let fillColor = styles.fillColor || '#ffffff';
    let borderColor = styles.borderColor || '#000000';
    
    const rgbToHex = (color: string) => {
      if (color.startsWith('rgb')) {
        const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (match) {
          const hex = `${parseInt(match[1]).toString(16).padStart(2, '0')}${parseInt(match[2]).toString(16).padStart(2, '0')}${parseInt(match[3]).toString(16).padStart(2, '0')}`;
          return `0x${hex}`;
        }
      }
      if (color.startsWith('#')) {
        return `0x${color.slice(1)}`;
      }
      return color;
    };
    
    fillColor = rgbToHex(fillColor);
    borderColor = rgbToHex(borderColor);
    const borderWidth = styles.borderWidth || 1;
    const opacity = parseFloat(styles.opacity) || 1.0;
    const alpha = Math.round(opacity * 255).toString(16).padStart(2, '0');
    const fillColorWithAlpha = `${fillColor}${alpha}`;
    
    if (windows.length === 0) return filters;
    
    const enableConditions = windows.map(([start, end]) => {
      const s = start.toFixed(3);
      const e = end.toFixed(3);
      return start === end ? `gte(t,${s})` : `between(t,${s},${e})`;
    }).join('+');
    
    if (styles.hasShadow) {
      const shadowColor = rgbToHex(styles.shadowColor || '#000000');
      const shadowX = x + parseInt(styles.shadowOffsetX || 0);
      const shadowY = y + parseInt(styles.shadowOffsetY || 0);
      const shadowFilter = `drawbox=x=${shadowX}:y=${shadowY}:w=${w}:h=${h}:color=${shadowColor}80:t=fill:enable='${enableConditions}'`;
      filters.push(shadowFilter);
    }
    
    if (styles.fillType === 'radial') {
      const color1 = rgbToHex(styles.gradientColor1 || '#ffffff');
      const color2 = rgbToHex(styles.gradientColor2 || '#000000');
      const c1r = parseInt(color1.slice(2, 4), 16);
      const c1g = parseInt(color1.slice(4, 6), 16);
      const c1b = parseInt(color1.slice(6, 8), 16);
      const c2r = parseInt(color2.slice(2, 4), 16);
      const c2g = parseInt(color2.slice(4, 6), 16);
      const c2b = parseInt(color2.slice(6, 8), 16);
      const cx = x + w / 2;
      const cy = y + h / 2;
      const maxR = Math.sqrt((w/2) * (w/2) + (h/2) * (h/2));
      const a1r = Math.round(c1r * opacity);
      const a1g = Math.round(c1g * opacity);
      const a1b = Math.round(c1b * opacity);
      const a2r = Math.round(c2r * opacity);
      const a2g = Math.round(c2g * opacity);
      const a2b = Math.round(c2b * opacity);
      const timeCondition = windows.map(([start, end]) => {
        const s = start.toFixed(3);
        const e = end.toFixed(3);
        return start === end ? `gte(T,${s})` : `between(T,${s},${e})`;
      }).join('+');
      const gradFilter = `geq=r='if((${timeCondition})*between(X\,${x}\,${x+w-1})*between(Y\,${y}\,${y+h-1})\,r(X\,Y)*(1-${opacity})+(${a1r}+(${a2r}-${a1r})*min(hypot(X-${cx}\,Y-${cy})/${maxR}\,1))*${opacity}\,r(X\,Y))':g='if((${timeCondition})*between(X\,${x}\,${x+w-1})*between(Y\,${y}\,${y+h-1})\,g(X\,Y)*(1-${opacity})+(${a1g}+(${a2g}-${a1g})*min(hypot(X-${cx}\,Y-${cy})/${maxR}\,1))*${opacity}\,g(X\,Y))':b='if((${timeCondition})*between(X\,${x}\,${x+w-1})*between(Y\,${y}\,${y+h-1})\,b(X\,Y)*(1-${opacity})+(${a1b}+(${a2b}-${a1b})*min(hypot(X-${cx}\,Y-${cy})/${maxR}\,1))*${opacity}\,b(X\,Y))'`;
      filters.push(gradFilter);
    } else if (styles.fillType === 'gradient') {
      const color1 = rgbToHex(styles.gradientColor1 || '#ffffff');
      const color2 = rgbToHex(styles.gradientColor2 || '#000000');
      const angle = parseFloat(styles.gradientAngle || 0);
      const c1r = parseInt(color1.slice(2, 4), 16);
      const c1g = parseInt(color1.slice(4, 6), 16);
      const c1b = parseInt(color1.slice(6, 8), 16);
      const c2r = parseInt(color2.slice(2, 4), 16);
      const c2g = parseInt(color2.slice(4, 6), 16);
      const c2b = parseInt(color2.slice(6, 8), 16);
      const a1r = Math.round(c1r * opacity);
      const a1g = Math.round(c1g * opacity);
      const a1b = Math.round(c1b * opacity);
      const a2r = Math.round(c2r * opacity);
      const a2g = Math.round(c2g * opacity);
      const a2b = Math.round(c2b * opacity);
      const rad = ((90 - angle) * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const cx = x + w / 2;
      const cy = y + h / 2;
      const maxDist = Math.max(w, h);
      const timeCondition = windows.map(([start, end]) => {
        const s = start.toFixed(3);
        const e = end.toFixed(3);
        return start === end ? `gte(T,${s})` : `between(T,${s},${e})`;
      }).join('+');
      const gradFilter = `geq=r='if((${timeCondition})*between(X\,${x}\,${x+w-1})*between(Y\,${y}\,${y+h-1})\,r(X\,Y)*(1-${opacity})+(${a1r}+(${a2r}-${a1r})*clip((((X-${cx})*${cos}-(Y-${cy})*${sin})/${maxDist}+0.5)\,0\,1))*${opacity}\,r(X\,Y))':g='if((${timeCondition})*between(X\,${x}\,${x+w-1})*between(Y\,${y}\,${y+h-1})\,g(X\,Y)*(1-${opacity})+(${a1g}+(${a2g}-${a1g})*clip((((X-${cx})*${cos}-(Y-${cy})*${sin})/${maxDist}+0.5)\,0\,1))*${opacity}\,g(X\,Y))':b='if((${timeCondition})*between(X\,${x}\,${x+w-1})*between(Y\,${y}\,${y+h-1})\,b(X\,Y)*(1-${opacity})+(${a1b}+(${a2b}-${a1b})*clip((((X-${cx})*${cos}-(Y-${cy})*${sin})/${maxDist}+0.5)\,0\,1))*${opacity}\,b(X\,Y))'`;
      filters.push(gradFilter);
    } else {
      const fillFilter = `drawbox=x=${x}:y=${y}:w=${w}:h=${h}:color=${fillColorWithAlpha}:t=fill:enable='${enableConditions}'`;
      filters.push(fillFilter);
    }
    
    if (borderWidth > 0) {
      const borderFilter = `drawbox=x=${x}:y=${y}:w=${w}:h=${h}:color=${borderColor}:t=${borderWidth}:enable='${enableConditions}'`;
      filters.push(borderFilter);
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
    
    if (windows.length === 0) return filters;
    
    const enableConditions = windows.map(([start, end]) => {
      const s = start.toFixed(3);
      const e = end.toFixed(3);
      return start === end ? `gte(t,${s})` : `between(t,${s},${e})`;
    }).join('+');
    
    lines.forEach((line: string, index: number) => {
      const text = line.replace(/'/g, "'").replace(/\\/g, '\\\\').replace(/:/g, '\\:').trim();
      if (!text) return;
      
      const yPos = y + (index * lineHeight) + fontSize;
      let xPos = x;
      
      if (styles.hasShadow) {
        const shadowBlur = Math.max(2, styles.shadowBlur || 4);
        const shadowOffsetX = styles.shadowOffsetX || 0;
        const shadowOffsetY = styles.shadowOffsetY || 0;
        const shadowColor = styles.shadowColor || '#000000';
        
        for (let i = 0; i < shadowBlur; i++) {
          const alpha = Math.round((1 - i / shadowBlur) * 128).toString(16).padStart(2, '0');
          const offset = i;
          
          let shadowFilter = `drawtext=text='${text}':fontfile=${fontFile}:fontsize=${fontSize}:fontcolor=${shadowColor}${alpha}:box=0`;
          
          if (textAlign === 'center') {
            shadowFilter += `:x=${x + (data.width || 100) / 2 + shadowOffsetX + offset}-text_w/2:y=${yPos + shadowOffsetY + offset}`;
          } else if (textAlign === 'right') {
            shadowFilter += `:x=${x + (data.width || 100) + shadowOffsetX + offset}-text_w:y=${yPos + shadowOffsetY + offset}`;
          } else {
            shadowFilter += `:x=${xPos + shadowOffsetX + offset}:y=${yPos + shadowOffsetY + offset}`;
          }
          
          shadowFilter += `:enable='${enableConditions}'`;
          filters.push(shadowFilter);
        }
      }
      
      let textFilter = `drawtext=text='${text}':fontfile=${fontFile}:fontsize=${fontSize}:fontcolor=${fontColor}:box=0`;
      
      if (textAlign === 'center') {
        xPos = x + (data.width || 100) / 2;
        textFilter += `:x=${xPos}-text_w/2:y=${yPos}`;
      } else if (textAlign === 'right') {
        xPos = x + (data.width || 100);
        textFilter += `:x=${xPos}-text_w:y=${yPos}`;
      } else {
        textFilter += `:x=${xPos}:y=${yPos}`;
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
        '-filter_complex', `${filterString}[v]`,
        '-map', '[v]',
        '-map', '0:a?',
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
    const progressPath = path.join(process.cwd(), 'jobs', this.jobId, `${this.jobId}_progress.txt`);
    console.log('Progress path:', progressPath);
    
    try {
      await fs.writeFile(progressPath, '');
      console.log('Progress file created');
    } catch (err) {
      console.error('Failed to create progress file:', err);
    }
    
    return new Promise((resolve) => {
      const ffmpeg = spawn('ffmpeg', [...args, '-progress', progressPath]);
      let stderr = '';
      
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
