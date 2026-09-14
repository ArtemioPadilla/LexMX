/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />
// Types from Astro are automatically included
interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL?: string;
  readonly PUBLIC_SUPABASE_ANON_KEY?: string;
  readonly PUBLIC_REPO_SLUG?: string;
  readonly PUBLIC_BUILD_SHA?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
