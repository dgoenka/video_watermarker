const { VideoProcessor } = require('../dist/processor');
const fs = require('fs');

const sample = {
  video_width: 1280,
  video_height: 720,
  video_duration: 15,
  canvas_width: 1280,
  canvas_height: 720,
  nodes: [
    {
      id: 'rect',
      type: 'rectangle',
      position: { x: 4.5703125, y: 19.0625 },
      width: 90.703125,
      height: 59.30555555555556,
      data: {
        visible: true,
        styles: {
          fillType: 'radial',
          fillColor: 'rgb(124, 124, 124)',
          gradientColor1: '#00ffff',
          gradientColor2: '#0000ff',
          gradientAngle: 90,
          borderColor: 'rgb(252,252,252)',
          borderWidth: 1,
          opacity: '1',
          hasShadow: false,
          show: true
        },
        timestamps: [0, 0]
      }
    },
    {
      id: 'text',
      type: 'text',
      position: { x: 16.3671875, y: 33.229166666666664 },
      width: 66.171875,
      height: 29.72222222222222,
      data: {
        visible: true,
        text: 'Enter text',
        styles: {
          fontFamily: 'Arial',
          fontSize: '13.90625%',
          fontColor: 'rgb(252, 252, 252)',
          textAlign: 'left',
          fillType: 'solid',
          fillColor: 'transparent',
          opacity: 1
        },
        timestamps: [0, 0]
      }
    }
  ]
};

const proc = new VideoProcessor('test', '/dev/null', '/dev/null', sample);
const filters = proc.generateFilters();
fs.writeFileSync('filter.txt', filters.join(','));
console.log('Wrote filter.txt');
