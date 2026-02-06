// Test-only overlay renderer using node-canvas
// Usage: npm install (to install canvas) then npm run render-overlay

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

const out = path.join(__dirname, 'overlay.png');

async function render() {
  // Example canvas size - should match the DOM canvas used when authoring
  const width = 1280;
  const height = 720;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Clear transparent
  ctx.clearRect(0, 0, width, height);

  // Draw radial gradient rectangle with rounded corners
  const x = 50;
  const y = 50;
  const w = width - 100;
  const h = height - 200;

  // shadow: draw blurred shadow by drawing to an offscreen canvas and applying gaussian blur
  // node-canvas doesn't have a native blur filter, but compositing multiple translucent rects approximates it.
  const shadowColor = 'rgba(0,0,0,0.6)';
  for (let i = 8; i > 0; i--) {
    ctx.fillStyle = `rgba(0,0,0,${0.12 * i})`;
    ctx.fillRect(x - i, y - i, w + i * 2, h + i * 2);
  }

  // radial gradient fill
  const cx = x + w / 2;
  const cy = y + h / 2;
  const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, Math.max(w, h) / 1.2);
  grad.addColorStop(0, '#0ff');
  grad.addColorStop(1, '#00f');

  // rounded rect clip
  const radius = 8;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.clip();

  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);
  ctx.restore();

  // text with shadow - multiple passes to approximate blur
  const text = 'Enter text';
  const fontSize = Math.round(w * 0.14); // approx 14% of canvas width
  ctx.font = `${fontSize}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const tx = x + w / 2;
  const ty = y + h / 2;

  // shadow passes
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  for (let i = 1; i <= 6; i++) {
    ctx.fillText(text, tx + i, ty + i);
  }

  // main text
  ctx.fillStyle = '#fcfcfc';
  ctx.fillText(text, tx, ty);

  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(out, buffer);
  console.log('Wrote overlay to', out);
}

render().catch(err => { console.error(err); process.exit(1); });
