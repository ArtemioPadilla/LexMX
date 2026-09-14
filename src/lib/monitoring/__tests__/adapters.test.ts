import { describe, expect, it } from 'vitest';
import { ADAPTERS, contentHash, getAdapter, matchEvents, mentionsExpediente, normalizeExpediente, parseDofNotes, parseRss } from '../adapters';

const RSS = `<?xml version="1.0"?><rss><channel>
<item><title>Lista de acuerdos: expediente 123/2026 amparo indirecto</title><link>https://example.test/a</link><description><![CDATA[Se admite la <b>demanda</b> &amp; se fija fecha]]></description><pubDate>Mon, 14 Sep 2026 10:00:00 GMT</pubDate></item>
<item><title>Otro asunto 999/2026</title><link>https://example.test/b</link><description>nada</description><pubDate>invalid</pubDate></item>
</channel></rss>`;

describe('monitoring adapters', () => {
  it('normalizes docket numbers before matching', () => {
    expect(normalizeExpediente(' 123 - 2026 ')).toBe('123/2026');
    expect(mentionsExpediente({ title: 'Exp. 123-2026', body: '', url: null, date: '' }, '123/2026')).toBe(true);
    expect(mentionsExpediente({ title: 'Exp. 1234/2026', body: '', url: null, date: '' }, '234/2026')).toBe(true);
    expect(mentionsExpediente({ title: 'nada', body: '', url: null, date: '' }, '')).toBe(false);
  });

  it('parses RSS items with CDATA, entities and invalid dates', () => {
    const items = parseRss(RSS);
    expect(items).toHaveLength(2);
    expect(items[0]?.title).toContain('123/2026');
    expect(items[0]?.body).toBe('Se admite la demanda & se fija fecha');
    expect(items[0]?.url).toBe('https://example.test/a');
    expect(items[0]?.date).toBe('2026-09-14T10:00:00.000Z');
    expect(() => new Date(items[1]!.date).toISOString()).not.toThrow();
  });

  it('parses DOF daily notes from either list shape', () => {
    const payload = JSON.stringify({ NotasMatutinas: [{ codNota: '5700001', titulo: 'ACUERDO por el que se reforma…', fecha: '14/09/2026', sinopsis: 'sin.' }], NotasVespertinas: [] });
    const items = parseDofNotes(payload);
    expect(items).toHaveLength(1);
    expect(items[0]?.url).toContain('codigo=5700001');
    expect(items[0]?.date).toBe('2026-09-14T00:00:00.000Z');
    expect(parseDofNotes('not json')).toEqual([]);
  });

  it('matches items to watched cases of the same court and builds a stable hash', () => {
    const adapter = getAdapter('mx-pjf')!;
    const items = parseRss(RSS);
    const cases = [
      { id: 'c1', court: 'mx-pjf', expediente: '123/2026' },
      { id: 'c2', court: 'mx-dof', expediente: '123/2026' },
      { id: 'c3', court: 'mx-pjf', expediente: '555/2026' },
    ];
    const events = matchEvents(adapter, items, cases);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ caseId: 'c1', kind: 'aviso', sourceUrl: 'https://example.test/a' });
    expect(events[0]?.summary).toContain('Se admite la demanda');
    expect(events[0]?.contentHash).toBe(matchEvents(adapter, items, cases)[0]?.contentHash);
    expect(contentHash('a')).not.toBe(contentHash('b'));
  });

  it('exposes feed URLs for every adapter', () => {
    for (const a of ADAPTERS) expect(a.feedUrl(new Date('2026-09-14T12:00:00Z'))).toMatch(/^https:\/\//);
    expect(getAdapter('mx-dof')?.feedUrl(new Date('2026-09-14T12:00:00Z'))).toContain('/14/09/2026');
  });
});
