/**
 * Single source of the site's machine-readable identity: name, description,
 * repo slug and license. Feeds the FeedbackFAB, issue reports, JSON-LD and
 * the default <meta name="description">.
 *
 * SITE_ORIGIN is declared here AND in /site.config.mjs (astro.config.mjs runs
 * before Vite and cannot import this file); keep both in sync.
 */
export const SITE_ORIGIN = 'https://artemiop.com';
export const SITE = {
  /** Product name as it should appear to agents and search engines. */
  name: 'LexMX',
  /** One-line positioning (used as the default meta description). */
  description:
    'Asistente legal mexicano con IA: consulta la legislación y jurisprudencia ' +
    'con citas verificables, sin que tus documentos salgan de tu equipo.',
  /** owner/repo on GitHub. */
  repoSlug: (import.meta.env.PUBLIC_REPO_SLUG as string | undefined) ?? 'ArtemioPadilla/LexMX',
  /** SPDX license id of the codebase. */
  license: 'MIT',
  /** Languages an agent should expect in the source. */
  programmingLanguages: ['TypeScript', 'Astro', 'CSS'],
} as const;

/** Absolute repo URL derived from the slug. */
export const REPO_URL = `https://github.com/${SITE.repoSlug}`;

/** Absolute site origin + base (e.g. https://artemiop.com/LexMX). */
export function siteUrl(site: URL | undefined, base: string): string {
  const origin = (site ?? new URL('https://localhost')).origin;
  return `${origin}${base.replace(/\/$/, '')}`;
}
