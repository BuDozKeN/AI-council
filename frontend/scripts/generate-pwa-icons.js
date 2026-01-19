#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Generate PNG icons for PWA from SVG source
 * Required for iOS compatibility (apple-touch-icon must be PNG)
 */

import { Resvg } from '@resvg/resvg-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, '..', 'public');

// Icon sizes needed for PWA
const sizes = [
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'pwa-192x192.png', size: 192 },
  { name: 'pwa-512x512.png', size: 512 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'favicon-16x16.png', size: 16 },
];

// Read the source SVG
const svgPath = path.join(publicDir, 'favicon.svg');
const svgContent = fs.readFileSync(svgPath, 'utf8');

console.log('Generating PWA icons from favicon.svg...\n');

for (const { name, size } of sizes) {
  const resvg = new Resvg(svgContent, {
    fitTo: {
      mode: 'width',
      value: size,
    },
  });

  const pngData = resvg.render();
  const pngBuffer = pngData.asPng();

  const outputPath = path.join(publicDir, name);
  fs.writeFileSync(outputPath, pngBuffer);

  console.log(`  Created ${name} (${size}x${size})`);
}

console.log('\nDone! PNG icons generated successfully.');
