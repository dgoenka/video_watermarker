 const { VideoProcessor } = require('../dist/processor');
const fs = require('fs');

const sample = {
  video_width: 1280,
  video_height: 720,
  video_duration: 15,
  canvas_width: 1280,
  canvas_height: 720,
  video_node_width: 640,
  video_node_height: 360,
  use_percentages: true,
  nodes: [
    { id: 'rect', type: 'rectangle', position: { x: 4.5703125, y: 19.0625 }, width: 90.703125, height: 59.30555555555556, data: { visible: true, styles: { fillType: 'radial', gradientColor1: '#00ffff', gradientColor2: '#0000ff', borderColor: 'rgb(252,252,252)', borderWidth: 1, opacity: '1', hasShadow: true, shadowColor: '#000000', shadowOffsetX: 2, shadowOffsetY: 2, shadowBlur: 8, shadowOpacity: 0.6, show: true }, timestamps: [0,0] } },
    { id: 'text', type: 'text', position: { x: 16.3671875, y: 33.229166666666664 }, width: 66.171875, height: 29.72222222222222, data: { visible: true, text: 'Enter text', styles: { fontFamily: 'Arial', fontSize: '13.90625%', fontColor: 'rgb(252, 252, 252)', textAlign: 'left', fillType: 'solid', fillColor: 'transparent', opacity: 1, hasShadow: true, shadowColor: '#000000', shadowOffsetX: 2, shadowOffsetY: 2, shadowBlur: 6, shadowOpacity: 0.6 }, timestamps: [0,0] } }
  ]
};

const proc = new VideoProcessor('test', '/dev/null', '/dev/null', sample);
const filters = proc.generateFilters();
fs.writeFileSync('filter_test_shadow_local.txt', filters.join(','));
console.log('WROTE filter_test_shadow_local.txt');
