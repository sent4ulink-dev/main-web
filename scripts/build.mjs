// Builds the static site into dist/ for Cloudflare Pages: only the files the browser needs
// (not worker/, not the docs, not node_modules). Run with: npm run build
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const OUT = 'dist';
const FILES = ['index.html', 'style.css', 'script.js', 'finale.js', 'earth-scene.js', 'viewport.js', 'tilt.js', '_headers'];
const DIRS = ['vendor', 'assets'];

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT);
for (const f of FILES) if (existsSync(f)) cpSync(f, join(OUT, f));
for (const d of DIRS) cpSync(d, join(OUT, d), { recursive: true });
console.log(`built ${OUT}/ (${[...FILES, ...DIRS.map(d => d + '/')].join(', ')})`);
