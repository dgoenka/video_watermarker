const { VideoProcessor } = require('../dist/processor');

async function run() {
  const sampleData = {
    video_width: 640,
    video_height: 360,
    video_duration: 10,
    canvas_width: 640,
    canvas_height: 360,
    nodes: [
      {
        id: 'rect1',
        type: 'rectangle',
        position: { x: 10, y: 20 },
        width: 200,
        height: 100,
        data: {
          visible: true,
          styles: {
            fillType: 'radial',
            gradientColor1: '#ff0000',
            gradientColor2: '#0000ff',
            opacity: 0.8,
            borderWidth: 2,
            borderColor: '#00ff00'
          },
          // Use [0,0] timestamps to reproduce the edge-case
          timestamps: [0, 0]
        }
      },
      {
        id: 'text1',
        type: 'text',
        position: { x: 50, y: 150 },
        width: 400,
        height: 50,
        data: {
          visible: true,
          text: 'Hello World',
          styles: {
            fontSize: 24,
            fontFamily: 'Arial',
            fontColor: '#ffffff',
            textAlign: 'left'
          },
          timestamps: [0, 0]
        }
      }
    ]
  };

  const proc = new VideoProcessor('testjob', 'input.mp4', 'output.mp4', sampleData);
  const filters = proc.generateFilters();
  console.log('Generated filters:', filters);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
