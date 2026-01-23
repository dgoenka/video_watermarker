import subprocess
import json
import os
from pathlib import Path
from typing import Dict, Any, List
from config import settings

class VideoProcessor:
    def __init__(self, job_id: str, video_path: str, components: List[Dict[str, Any]], 
                 video_width: int, video_height: int, video_duration: float):
        self.job_id = job_id
        self.video_path = video_path
        self.components = components
        self.video_width = video_width
        self.video_height = video_height
        self.video_duration = video_duration
        self.output_path = os.path.join(settings.output_dir, f"{job_id}.mp4")
    
    def generate_ffmpeg_filters(self) -> str:
        """Generate FFmpeg filter complex for overlaying components"""
        filters = []
        
        for idx, component in enumerate(self.components):
            comp_type = component.get('type')
            position = component.get('position', {})
            width = component.get('width', 0)
            height = component.get('height', 0)
            data = component.get('data', {})
            timestamps = data.get('timestamps', [])
            styles = data.get('styles', {})
            
            x = int(position.get('x', 0))
            y = int(position.get('y', 0))
            w = int(width)
            h = int(height)
            
            # Calculate visibility windows
            visibility_windows = self._calculate_visibility_windows(timestamps, self.video_duration)
            
            if comp_type == 'rectangle':
                filters.extend(self._generate_rectangle_filter(x, y, w, h, styles, visibility_windows, idx))
            elif comp_type == 'circle':
                filters.extend(self._generate_circle_filter(x, y, w, h, styles, visibility_windows, idx))
            elif comp_type == 'text':
                filters.extend(self._generate_text_filter(x, y, data, styles, visibility_windows, idx))
            elif comp_type == 'picture':
                filters.extend(self._generate_picture_filter(x, y, w, h, data, visibility_windows, idx))
            elif comp_type == 'line':
                filters.extend(self._generate_line_filter(data, styles, visibility_windows, idx))
        
        return ','.join(filters) if filters else None
    
    def _calculate_visibility_windows(self, timestamps: List[float], duration: float) -> List[tuple]:
        """Calculate time windows when component is visible"""
        if not timestamps:
            return []
        
        windows = []
        for i in range(0, len(timestamps), 2):
            start = timestamps[i]
            end = timestamps[i + 1] if i + 1 < len(timestamps) else duration
            windows.append((start, end))
        
        return windows
    
    def _generate_rectangle_filter(self, x: int, y: int, w: int, h: int, 
                                   styles: Dict, windows: List[tuple], idx: int) -> List[str]:
        """Generate rectangle overlay filter"""
        filters = []
        fill_color = styles.get('fillColor', '#ffffff').replace('#', '0x')
        border_color = styles.get('borderColor', '#000000').replace('#', '0x')
        border_width = styles.get('borderWidth', 1)
        opacity = styles.get('opacity', 1.0)
        
        for start, end in windows:
            enable_expr = f"between(t,{start},{end})"
            filter_str = (
                f"drawbox=x={x}:y={y}:w={w}:h={h}:"
                f"color={fill_color}@{opacity}:t=fill:enable='{enable_expr}'"
            )
            filters.append(filter_str)
            
            if border_width > 0:
                border_filter = (
                    f"drawbox=x={x}:y={y}:w={w}:h={h}:"
                    f"color={border_color}:t={border_width}:enable='{enable_expr}'"
                )
                filters.append(border_filter)
        
        return filters
    
    def _generate_circle_filter(self, x: int, y: int, w: int, h: int,
                                styles: Dict, windows: List[tuple], idx: int) -> List[str]:
        """Generate circle overlay filter (approximated with drawbox)"""
        # FFmpeg doesn't have native circle drawing, use ellipse approximation
        return self._generate_rectangle_filter(x, y, w, h, styles, windows, idx)
    
    def _generate_text_filter(self, x: int, y: int, data: Dict, styles: Dict,
                             windows: List[tuple], idx: int) -> List[str]:
        """Generate text overlay filter"""
        filters = []
        text = data.get('text', 'Text')
        font_size = styles.get('fontSize', 16)
        font_color = styles.get('fontColor', '#000000').replace('#', '')
        
        for start, end in windows:
            enable_expr = f"between(t,{start},{end})"
            filter_str = (
                f"drawtext=text='{text}':x={x}:y={y}:"
                f"fontsize={font_size}:fontcolor={font_color}:"
                f"enable='{enable_expr}'"
            )
            filters.append(filter_str)
        
        return filters
    
    def _generate_picture_filter(self, x: int, y: int, w: int, h: int, data: Dict,
                                 windows: List[tuple], idx: int) -> List[str]:
        """Generate picture overlay filter"""
        # Picture overlay requires separate input, handled differently
        return []
    
    def _generate_line_filter(self, data: Dict, styles: Dict,
                             windows: List[tuple], idx: int) -> List[str]:
        """Generate line overlay filter"""
        filters = []
        start_point = data.get('startPoint', {})
        end_point = data.get('endPoint', {})
        color = styles.get('borderColor', '#ffffff').replace('#', '0x')
        width = styles.get('borderWidth', 2)
        
        x1 = int(start_point.get('x', 0))
        y1 = int(start_point.get('y', 0))
        x2 = int(end_point.get('x', 100))
        y2 = int(end_point.get('y', 0))
        
        for start, end in windows:
            enable_expr = f"between(t,{start},{end})"
            filter_str = (
                f"drawline=x1={x1}:y1={y1}:x2={x2}:y2={y2}:"
                f"color={color}:t={width}:enable='{enable_expr}'"
            )
            filters.append(filter_str)
        
        return filters
    
    def process(self) -> tuple[bool, str]:
        """Process video with FFmpeg"""
        try:
            os.makedirs(settings.output_dir, exist_ok=True)
            
            filter_complex = self.generate_ffmpeg_filters()
            
            if not filter_complex:
                # No overlays, just copy the video
                cmd = [
                    'ffmpeg', '-i', self.video_path,
                    '-c', 'copy', self.output_path, '-y'
                ]
            else:
                cmd = [
                    'ffmpeg', '-i', self.video_path,
                    '-filter_complex', filter_complex,
                    '-c:a', 'copy', self.output_path, '-y'
                ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=3600)
            
            if result.returncode == 0:
                return True, self.output_path
            else:
                return False, f"FFmpeg error: {result.stderr}"
        
        except subprocess.TimeoutExpired:
            return False, "Processing timeout exceeded"
        except Exception as e:
            return False, f"Processing error: {str(e)}"
