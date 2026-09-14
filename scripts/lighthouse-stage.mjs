// Stages dist/ under .lighthouse-root/LexMX so Lighthouse CI's static server
// serves the site at the same base path as GitHub Pages (/LexMX/).
import { cpSync, mkdirSync, rmSync } from 'node:fs';
const base = (process.env.ASTRO_BASE || '/LexMX').replace(/^\/+|\/+$/g, '');
const root = '.lighthouse-root';
rmSync(root, { recursive: true, force: true });
mkdirSync(`${root}/${base}`, { recursive: true });
cpSync('dist', `${root}/${base}`, { recursive: true });
console.log(`staged dist/ → ${root}/${base}/`);
