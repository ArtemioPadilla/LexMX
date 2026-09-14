/**
 * Guarded Supabase client (plan § 11.9, Inceptor recipe auth-supabase).
 * Only the public anon key reaches the browser; Row Level Security is the
 * boundary. Without PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_ANON_KEY the
 * client is null and every server feature shows "servidor no configurado":
 * that is the local-first mode and the build still passes.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = ((import.meta.env.PUBLIC_SUPABASE_URL as string | undefined) ?? '').trim();
const anonKey = ((import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined) ?? '').trim();

export const supabaseEnabled = url.length > 0 && anonKey.length > 0;

export const supabase: SupabaseClient | null = supabaseEnabled
  ? createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;
