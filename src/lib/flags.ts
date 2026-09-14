/**
 * Feature flags — env-aware beta/prod gating.
 *
 * Flags are defined as typed accessors. Values come from `import.meta.env`
 * at build time (Astro's standard env handling), with explicit defaults so
 * a missing env var never crashes the app.
 *
 * Naming convention: every flag env var is `PUBLIC_FLAG_<NAME>` so it's
 * inlined into the browser bundle by Astro. Server-only flags would use
 * a different prefix; we don't have a backend yet.
 *
 * Usage in islands or pages:
 *
 *   import { flags } from '@/lib/flags';
 *   if (flags.experimentalGallery) { … }
 */

/** Boolean coercion that respects "0", "false", "off" as false. */
function asBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === '') return defaultValue;
  const v = value.toLowerCase().trim();
  if (v === 'true' || v === '1' || v === 'on' || v === 'yes') return true;
  if (v === 'false' || v === '0' || v === 'off' || v === 'no') return false;
  return defaultValue;
}

/** Build-time channel marker. `production` | `preview` | `development`. */
export type Channel = 'production' | 'preview' | 'development';

function detectChannel(): Channel {
  const explicit = import.meta.env.PUBLIC_CHANNEL as string | undefined;
  if (explicit === 'production' || explicit === 'preview' || explicit === 'development') {
    return explicit;
  }
  if (import.meta.env.PROD) return 'production';
  return 'development';
}

const env = import.meta.env as Record<string, string | undefined>;

export const flags = {
  /** The current release channel. */
  channel: detectChannel(),

  /** Show experimental gallery features (props playground, etc.). */
  experimentalGallery: asBool(env.PUBLIC_FLAG_EXPERIMENTAL_GALLERY, false),

  /** Surface the floating feedback button on every page. */
  feedbackFab: asBool(env.PUBLIC_FLAG_FEEDBACK_FAB, true),

  /** Render the blog index + posts. Useful to hide until you have content. */
  blog: asBool(env.PUBLIC_FLAG_BLOG, true),

  /** Enable the docs search bar (requires Pagefind index to exist). */
  docsSearch: asBool(env.PUBLIC_FLAG_DOCS_SEARCH, true),

  /** Show the install + update prompts on every page. */
  pwaPrompts: asBool(env.PUBLIC_FLAG_PWA_PROMPTS, true),

  /** Show the first-load privacy disclosure toast (ethics — Epic 12). */
  privacyToast: asBool(env.PUBLIC_FLAG_PRIVACY_TOAST, true),

  /**
   * Enable analytics (Plausible / Umami). Uses asBool so '1'/'on'/'yes' also
   * work, consistent with all other flags. analytics.ts reads this flag.
   */
  analytics: asBool(env.PUBLIC_FLAG_ANALYTICS, false),

  /**
   * Enable Sentry error reporting. Uses asBool for consistent truthy handling.
   * sentry.ts reads this flag.
   */
  sentry: asBool(env.PUBLIC_FLAG_SENTRY, false),
} as const;

export type Flags = typeof flags;

/**
 * Helper: only show this thing in `production` channel.
 * Use cases: production analytics, real GitHub API calls, etc.
 */
export function isProduction(): boolean {
  return flags.channel === 'production';
}
