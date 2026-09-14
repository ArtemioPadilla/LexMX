/**
 * Single source of truth for the canonical production origin.
 * astro.config.mjs runs in Node before Vite starts, so it cannot import
 * TypeScript files that use `import.meta.env`; this file is dependency-free
 * so both astro.config.mjs and src/lib/site-meta.ts consume the same value.
 */
export const SITE_ORIGIN = 'https://artemiop.com';

/** Canonical URL for the site root (origin + base subpath). */
export function canonicalUrl(base = '/') {
  return `${SITE_ORIGIN}${base === '/' ? '' : base.replace(/\/$/, '')}`;
}
