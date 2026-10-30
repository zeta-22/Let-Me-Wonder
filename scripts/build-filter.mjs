// Packs src/filter/ into one file:
//   dist/let-me-wonder.user.js  for Safari on iPhone (Userscripts app)
// Usage: npm run build:filter

import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const pkg = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
const repo = 'zeta-22/Let-Me-Wonder';
const scriptUrl = `https://raw.githubusercontent.com/${repo}/main/dist/let-me-wonder.user.js`;

const result = await build({
  entryPoints: [new URL('src/filter/filter.js', root).pathname],
  bundle: true,
  format: 'iife',
  target: ['safari15', 'chrome100'],
  loader: { '.css': 'text' },
  define: { __LMW_VERSION__: JSON.stringify(pkg.version) },
  legalComments: 'none',
  write: false,
});
const code = result.outputFiles[0].text;

const header = `// ==UserScript==
// @name         Let Me Wonder
// @namespace    https://github.com/${repo}
// @version      ${pkg.version}
// @description  Instagram without Reels, Explore, suggestions and ads.
// @match        https://www.instagram.com/*
// @match        https://instagram.com/*
// @run-at       document-start
// @inject-into  content
// @noframes
// @grant        none
// @homepageURL  https://github.com/${repo}
// @updateURL    ${scriptUrl}
// @downloadURL  ${scriptUrl}
// ==/UserScript==

// Built from src/filter/ by scripts/build-filter.mjs. Edit those files, not this one.
`;

await mkdir(new URL('dist/', root), { recursive: true });
await writeFile(new URL('dist/let-me-wonder.user.js', root), header + code);
console.log(`Built dist/let-me-wonder.user.js (version ${pkg.version}, ${(code.length / 1024).toFixed(1)} KB)`);
