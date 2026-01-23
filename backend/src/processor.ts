import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { config } from './config';

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
}

export class VideoProcessor {
  constructor(
    private jobId: string,
    private videoPath: string,
    private videoData: VideoData
  ) {}

  private calculateVisibilityWindows(timestamps: number[], duration: number): [number, number][] {
    if (!timestamps || timestamps.length === 0) return [];
    
    const windows: [number, number][] = [];
    for (let i = 0; i < timestamps.length; i += 2) {
      const start = timestamps[i];
      const end = timestamps[i + 1] !== undefined ? timestamps[i + 1] : duration;
      windows.push([start, end]);
    }
    return windows;
  }

  private generateFilters(): string[] {
    const filters: string[] = [];
    
    for (const component of this.videoData.nodes) {
      const { type, position, width, height, data } = component;
      const timestamps = data.timestamps || [];
      const styles = data.styles || {};
      const windows = this.calculateVisibilityWindows(timestamps, this.videoData.video_duration);
      
      const x = Math.round(position.x);
      const y = Math.round(position.y);
      const w = Math.round(width);
      const h = Math.round(height);
      
      if (type === 'rectangle' || type === 'circle') {
        filters.push(...this.generateShapeFilters(x, y, w, h, styles, windows));
      } else if (type === 'text') {
        filters.push(...this.generateTextFilters(x, y, data, styles, windows));
      } else if (type === 'line') {
        filters.push(...this.generateLineFilters(data, styles, windows));
      }
    }
    
    return filters;
  }

  private generateShapeFilters(
    x: number, y: number, w: number, h: number,
    styles: any, windows: [number, number][]
  ): string[] {
    const filters: string[] = [];
    const fillColor = (styles.fillColor || '#ffffff').replace('#', '0x');
    const borderColor = (styles.borderColor || '#000000').replace('#', '0x');
    const borderWidth = styles.borderWidth || 1;
    const opacity = styles.opacity || 1.0;
    
    for (const [start, end] of windows) {
      const enable = `between(t,${start},${end})`;
      
      // Fill
      filters.push(`drawbox=x=${x}:y=${y}:w=${w}:h=${h}:color=${fillColor}@${opacity}:t=fill:enable='${enable}'`);
      
      // Border
      if (borderWidth > 0) {
        filters.push(`drawbox=x=${x}:y=${y}:w=${w}:h=${h}:color=${borderColor}:t=${borderWidth}:enable='${enable}'`);
      }
    }
    
    return filters;
  }

  private generateTextFilters(
    x: number, y: number, data: any, styles: any, windows: [number, number][]
  ): string[] {
    const filters: string[] = [];
    const text = (data.text || 'Text').replace(/'/g, "\\'");
    const fontSize = styles.fontSize || 16;
    const fontColor = (styles.fontColor || '#000000').replace('#', '');
    
    for (const [start, end] of windows) {
      const enable = `between(t,${start},${end})`;
      filters.push(`drawtext=text='${text}':x=${x}:y=${y}:fontsize=${fontSize}:fontcolor=${fontColor}:enable='${enable}'`);
    }
    
    return filters;
  }

  private generateLineFilters(data: any, styles: any, windows: [number, number][]): string[] {
    const filters: string[] = [];
    const startPoint = data.startPoint || { x: 0, y: 0 };
    const endPoint = data.endPoint || { x: 100, y: 0 };
    const color = (styles.borderColor || '#ffffff').replace('#', '0x');
    const width = styles.borderWidth || 2;
    
    const x1 = Math.round(startPoint.x);
    const y1 = Math.round(startPoint.y);
    const x2 = Math.round(endPoint.x);
    const y2 = Math.round(endPoint.y);
    
    for (const [start, end] of windows) {
      const enable = `between(t,${start},${end})`;
      filters.push(`drawline=x1=${x1}:y1=${y1}:x2=${x2}:y2=${y2}:color=${color}:t=${width}:enable='${enable}'`);
    }
    
    return filters;
  }

  async process(): Promise<{ success: boolean; result: string }> {
    try {
      await fs.mkdir(config.outputDir, { recursive: true });
      
      const outputPath = path.join(config.outputDir, `${this.jobId}.mp4`);
      const filters = this.generateFilters();
      
      const args = ['-i', this.videoPath];
      
      if (filters.length > 0) {
        args.push('-filter_complex', filters.join(','));
      }
      
      args.push('-c:a', 'copy', '-y', outputPath);
      
      return new Promise((resolve) => {
        const ffmpeg = spawn('ffmpeg', args);
        let stderr = '';
        
        ffmpeg.stderr.on('data', (data) => {
          stderr += data.toString();
        });
        
        ffmpeg.on('close', async (code) => {
          if (code === 0) {
            // Clean up uploaded video
            try {
              await fs.unlink(this.videoPath);
            } catch {}
            resolve({ success: true, result: outputPath });
          } else {
            resolve({ success: false, result: `FFmpeg error: ${stderr}` });
          }
        });
        
        ffmpeg.on('error', (err) => {
          resolve({ success: false, result: `Process error: ${err.message}` });
        });
      });
    } catch (error: any) {
      return { success: false, result: `Processing error: ${error.message}` };
    }
  }
}
