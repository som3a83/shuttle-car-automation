import fs from 'node:fs';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const root = process.cwd();
const output = path.join(root, 'artifacts', 'store-listing');
fs.mkdirSync(output, { recursive: true });

function render(sourcePath, destinationPath, width, height) {
  const svg = fs.readFileSync(sourcePath, 'utf8');
  const image = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    background: 'rgba(0,0,0,0)',
    shapeRendering: 2,
    textRendering: 2
  }).render();
  const png = image.asPng();
  fs.writeFileSync(destinationPath, png);
  return { width: image.width, height: image.height, bytes: png.length };
}

const iconSource = path.join(root, 'assets', 'logo.svg');
const graphicSource = path.join(root, 'assets', 'play', 'feature-graphic.svg');
if (!fs.existsSync(iconSource) || !fs.existsSync(graphicSource)) {
  throw new Error('Store artwork source SVG files are missing.');
}

const icon512 = render(iconSource, path.join(output, 'icon-512.png'), 512, 512);
const icon192 = render(iconSource, path.join(root, 'public', 'shuttle-icon-192.png'), 192, 192);
const graphic = render(graphicSource, path.join(output, 'feature-graphic-1024x500.png'), 1024, 1024);
if (graphic.width !== 1024 || graphic.height !== 500) {
  throw new Error('Feature graphic must be exactly 1024x500 pixels; got ' + graphic.width + 'x' + graphic.height);
}
const icon = render(iconSource, path.join(root, 'public', 'shuttle-icon-512.png'), 512, 512);
if (icon.width !== 512 || icon.height !== 512) throw new Error('PWA icon must be 512x512.');
console.log(JSON.stringify({ icon512, icon192, icon512Pwa: icon, featureGraphic: graphic }, null, 2));
