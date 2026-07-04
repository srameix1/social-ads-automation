// Copies non-TypeScript assets (fonts, music) into dist/, since `tsc` only emits .ts files.
const fs   = require('fs');
const path = require('path');

const src = path.join(__dirname, '../src/assets');
const dest = path.join(__dirname, '../dist/assets');

fs.cpSync(src, dest, { recursive: true });
console.log(`[copy-assets] ${src} -> ${dest}`);
