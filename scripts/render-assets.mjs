#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import { dirname } from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const targets = [
  {
    svgPath: 'media/icon.svg',
    pngPath: 'media/icon.png',
    width: 128
  },
  {
    svgPath: 'media/banner.svg',
    pngPath: 'media/banner.png',
    width: 1400
  }
];

async function ensureDir(filePath) {
  await fs.mkdir(dirname(filePath), { recursive: true });
}

async function renderSvg(target) {
  const svg = await fs.readFile(target.svgPath, 'utf8');
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: target.width },
    background: 'rgba(0,0,0,0)'
  });
  const pngData = resvg.render().asPng();
  await ensureDir(target.pngPath);
  await fs.writeFile(target.pngPath, pngData);
  console.log(`Rendered ${target.pngPath}`);
}

async function main() {
  for (const target of targets) {
    await renderSvg(target);
  }
}

main().catch((error) => {
  console.error('Failed to render assets:', error);
  process.exit(1);
});
