/**
 * Invariants of the Supabase schema (plan § 11.9). Pure text checks over
 * `supabase/migrations/*.sql`: they run without Postgres and catch the two
 * mistakes that would silently break the local-first promise, a public table
 * without RLS and a mutable audit log.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const DIR = resolve(process.cwd(), 'supabase/migrations');
const files = existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort() : [];
const sql = Object.fromEntries(files.map((f) => [f, readFileSync(resolve(DIR, f), 'utf8')]));
const all = Object.values(sql).join('\n');

function publicTables(text: string): string[] {
  return [...text.matchAll(/create table if not exists public\.([a-z_]+)/g)].map((m) => m[1]!);
}

describe('supabase migrations', () => {
  it('exist and are numbered sequentially', () => {
    expect(files.length).toBeGreaterThanOrEqual(6);
    files.forEach((f, i) => expect(f.startsWith(String(i + 1).padStart(4, '0') + '_')).toBe(true));
  });

  it('enable RLS on every public table', () => {
    for (const table of publicTables(all)) {
      expect(all, `RLS missing for public.${table}`).toMatch(new RegExp(`alter table public\\.${table} enable row level security`));
    }
  });

  it('give every public table at least one policy', () => {
    for (const table of publicTables(all)) {
      expect(all, `no policy for public.${table}`).toMatch(new RegExp(`create policy "[^"]+" on public\\.${table}`));
    }
  });

  it('keep the audit log append-only', () => {
    const audit = sql['0003_audit_log.sql'] ?? '';
    expect(audit).toMatch(/revoke insert, update, delete, truncate on public\.audit_log/);
    expect(audit).not.toMatch(/create policy "[^"]+" on public\.audit_log\s+for (update|delete|all)/);
  });

  it('never let authenticated users write subscriptions or usage', () => {
    const billing = sql['0002_subscriptions_usage.sql'] ?? '';
    for (const table of ['subscriptions', 'usage']) {
      const policies = [...billing.matchAll(new RegExp(`create policy "[^"]+" on public\\.${table}\\s+for (\\w+)`, 'g'))].map((m) => m[1]);
      expect(policies, `${table} policies`).toEqual(['select']);
    }
    expect(billing).toMatch(/revoke execute on function public\.record_usage/);
  });

  it('store vectors with the client embedding dimension (384)', () => {
    expect(sql['0006_corpus_vectors.sql']).toMatch(/embedding vector\(384\)/);
    expect(sql['0006_corpus_vectors.sql']).toMatch(/query_embedding vector\(384\)/);
  });

  it('never stores query or document content outside the corpus tables', () => {
    const nonCorpus = files.filter((f) => !f.includes('corpus')).map((f) => sql[f]).join('\n');
    expect(nonCorpus).not.toMatch(/\b(query_text|question|prompt|document_text|expediente_content)\b/);
  });
});
