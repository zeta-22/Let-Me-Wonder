// Draws the app's icons (a simple leaf, our own design) and saves them as PNGs in
// assets/, using the headless Chrome that the tests use.
// Usage: node scripts/make-icons.mjs

import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const GREEN = '#2f6f4f';
const LEAF = (fill, vein) => `
  <path d="M22 78 C22 44 44 22 80 20 C80 56 58 78 24 78 Z" fill="${fill}"/>
  <path d="M26 74 L58 42" stroke="${vein}" stroke-width="5" stroke-linecap="round" fill="none"/>`;

// [file, size, background, leaf scale (share of the canvas), leaf colour, vein colour]
const ICONS = [
  ['icon.png', 1024, GREEN, 0.62, '#ffffff', GREEN],
  ['adaptive-icon.png', 1024, null, 0.42, '#ffffff', GREEN], // Android crops it to a circle or squircle
  ['splash-icon.png', 512, null, 0.9, GREEN, '#ffffff'],
  ['leaf.png', 192, null, 1, '#ffffff', 'transparent'], // tinted by the app on the Blocked screen
];

const root = new URL('../assets/', import.meta.url);
await mkdir(root, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [file, size, background, scale, leaf, vein] of ICONS) {
  const leafSize = size * scale;
  const offset = (size - leafSize) / 2;
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:${background || 'transparent'}">
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(${offset} ${offset}) scale(${leafSize / 100})">${LEAF(leaf, vein)}</g>
    </svg></body></html>`);
  await page.screenshot({ path: new URL(file, root).pathname, omitBackground: !background });
  console.log(`assets/${file} (${size}x${size})`);
}
await browser.close();
