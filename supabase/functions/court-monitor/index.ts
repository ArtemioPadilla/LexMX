// court-monitor · scheduled adapter run (plan § 11.9, línea D). pg_cron calls
// this function (see 0007_cron_monitoring.sql); it fetches each adapter's
// feed once, matches items against active `watched_cases`, and inserts new
// `court_events` (deduped by content_hash; the trigger fans out notifications).
// Only public sources are read; nothing about the user leaves the database.
import { json, preflight, serviceClient } from '../_shared/client.ts';
import { ADAPTERS, matchEvents, type WatchedCaseRef } from '../../../src/lib/monitoring/adapters.ts';

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  const secret = Deno.env.get('CRON_SECRET');
  if (secret && req.headers.get('x-cron-secret') !== secret) return json({ error: 'forbidden' }, 403);

  const supabase = serviceClient();
  const { data: cases, error } = await supabase
    .from('watched_cases')
    .select('id, court, expediente')
    .eq('active', true);
  if (error) return json({ error: error.message }, 500);
  const watched = (cases ?? []) as WatchedCaseRef[];
  const courts = new Set(watched.map((c) => c.court));

  const report: Record<string, { items: number; matched: number; inserted: number; error?: string }> = {};
  const now = new Date();
  for (const adapter of ADAPTERS) {
    if (!courts.has(adapter.id)) continue;
    const entry = { items: 0, matched: 0, inserted: 0 } as { items: number; matched: number; inserted: number; error?: string };
    report[adapter.id] = entry;
    try {
      const res = await fetch(adapter.feedUrl(now), { headers: { 'user-agent': 'LexMX court-monitor (+https://github.com/ArtemioPadilla/LexMX)' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const items = adapter.parse(await res.text());
      entry.items = items.length;
      const events = matchEvents(adapter, items, watched);
      entry.matched = events.length;
      if (events.length > 0) {
        const { data: inserted, error: insertError } = await supabase
          .from('court_events')
          .upsert(
            events.map((e) => ({
              case_id: e.caseId,
              occurred_at: e.occurredAt,
              kind: e.kind,
              summary: e.summary,
              source_url: e.sourceUrl,
              content_hash: e.contentHash,
            })),
            { onConflict: 'case_id,content_hash', ignoreDuplicates: true },
          )
          .select('id');
        if (insertError) throw new Error(insertError.message);
        entry.inserted = inserted?.length ?? 0;
      }
      const ids = watched.filter((c) => c.court === adapter.id).map((c) => c.id);
      await supabase.from('watched_cases').update({ last_checked_at: now.toISOString() }).in('id', ids);
    } catch (e) {
      entry.error = e instanceof Error ? e.message : String(e);
    }
  }
  return json({ ranAt: now.toISOString(), cases: watched.length, adapters: report });
});
