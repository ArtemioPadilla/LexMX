/**
 * Minimal fake of the Supabase query builder: records every call chain and
 * resolves with a canned response. Enough to assert table, verb, filters and
 * payload without Postgres.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export interface Recorded {
  table: string;
  calls: Array<[string, unknown[]]>;
}

export function fakeClient(responses: Array<{ data?: unknown; error?: { message: string } | null }> = []) {
  const log: Recorded[] = [];
  const queue = [...responses];
  const invoked: Array<{ name: string; body: unknown }> = [];
  const next = () => queue.shift() ?? { data: null, error: null };

  function builder(table: string) {
    const rec: Recorded = { table, calls: [] };
    log.push(rec);
    const proxy: Record<string, unknown> = {};
    const chain = new Proxy(proxy, {
      get(_t, prop: string) {
        if (prop === 'then') {
          const res = next();
          return (resolve: (v: unknown) => void) => resolve({ data: res.data ?? null, error: res.error ?? null });
        }
        return (...args: unknown[]) => {
          rec.calls.push([prop, args]);
          return chain;
        };
      },
    });
    return chain;
  }

  const client = {
    from: (table: string) => builder(table),
    functions: {
      invoke: async (name: string, opts: { body: unknown }) => {
        invoked.push({ name, body: opts.body });
        const res = next();
        return { data: res.data ?? null, error: res.error ?? null };
      },
    },
  } as unknown as SupabaseClient;

  return { client, log, invoked };
}
