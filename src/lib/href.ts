/**
 * Base-aware URL helper for internal links and public assets.
 *
 * When the site is deployed under a subpath (GitHub project pages serve at
 * `<domain>/<repo>/`), every internal link and `public/` asset reference must
 * be prefixed with Astro's `base`. Astro automatically prefixes built CSS/JS
 * and `<Image>` output, but NOT hardcoded string hrefs in markup — those go
 * through here.
 *
 * `import.meta.env.BASE_URL` is `/` in dev and at root deploys, and
 * `/<repo>/` (with trailing slash) when `base` is set for the Pages build.
 *
 *   withBase('/gallery/')   → '/gallery/'                     (dev / root)
 *                           → '/inceptor/gallery/'  (Pages)
 *   withBase('/favicon.svg')→ same idea for public assets
 */
export function withBase(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, ''); // strip trailing slash
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${base}${clean}`;
}
