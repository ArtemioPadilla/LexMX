/**
 * Court / gazette adapters (plan § 11.9, línea D): pure parsing and matching
 * so the scheduled Edge Function (`supabase/functions/court-monitor`) stays a
 * thin fetch-and-write loop. Each adapter turns a source payload into
 * candidate events and decides which watched case they belong to. Adding a
 * country or court means adding an adapter here plus its fetch URL.
 */

export interface WatchedCaseRef {
  id: string;
  court: string;
  expediente: string;
}

export interface CandidateEvent {
  caseId: string;
  occurredAt: string;
  kind: string;
  summary: string;
  sourceUrl: string | null;
  contentHash: string;
}

export interface SourceItem {
  title: string;
  body: string;
  url: string | null;
  date: string;
  kind?: string;
}

export interface Adapter {
  id: string;
  name: string;
  /** Where the scheduled job fetches today's items from. */
  feedUrl: (date: Date) => string;
  /** Parses the raw payload (JSON or RSS/XML text) into items. */
  parse: (payload: string) => SourceItem[];
  /** Default event kind when the item has none. */
  defaultKind: string;
}

/** Normalizes "123/2026", "123-2026", " 123 / 2026 " → "123/2026" so matches survive formatting. */
export function normalizeExpediente(s: string): string {
  return s.replace(/\s+/g, '').replace(/[-–—]/g, '/').toUpperCase();
}

/** Whether an item mentions the docket number (normalized on both sides). */
export function mentionsExpediente(item: SourceItem, expediente: string): boolean {
  const needle = normalizeExpediente(expediente);
  if (!needle) return false;
  const hay = normalizeExpediente(`${item.title} ${item.body}`);
  return hay.includes(needle);
}

/** Stable hash (FNV-1a, hex) of the parts that identify an event, for dedupe. */
export function contentHash(...parts: string[]): string {
  let h = 0x811c9dc5;
  const s = parts.join('');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** Matches parsed items against watched cases, producing insert-ready events. */
export function matchEvents(adapter: Adapter, items: SourceItem[], cases: WatchedCaseRef[]): CandidateEvent[] {
  const out: CandidateEvent[] = [];
  for (const c of cases) {
    if (c.court !== adapter.id) continue;
    for (const item of items) {
      if (!mentionsExpediente(item, c.expediente)) continue;
      out.push({
        caseId: c.id,
        occurredAt: item.date,
        kind: item.kind ?? adapter.defaultKind,
        summary: item.title.trim().slice(0, 280) + (item.body ? ` — ${item.body.replace(/\s+/g, ' ').trim().slice(0, 500)}` : ''),
        sourceUrl: item.url,
        contentHash: contentHash(adapter.id, c.expediente, item.date, item.title, item.url ?? ''),
      });
    }
  }
  return out;
}

/** Minimal RSS 2.0 / Atom item parser (title, link, description, pubDate) without DOM APIs. */
export function parseRss(xml: string): SourceItem[] {
  const items: SourceItem[] = [];
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>|<entry[\s>][\s\S]*?<\/entry>/gi) ?? [];
  const tag = (block: string, name: string): string => {
    const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i').exec(block);
    return m ? decodeEntities(m[1]!.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '')).trim() : '';
  };
  for (const block of blocks) {
    const linkAttr = /<link[^>]*href="([^"]+)"/i.exec(block)?.[1];
    const date = tag(block, 'pubDate') || tag(block, 'updated') || tag(block, 'published') || tag(block, 'dc:date');
    const parsed = date ? new Date(date) : null;
    items.push({
      title: tag(block, 'title'),
      body: tag(block, 'description') || tag(block, 'summary') || tag(block, 'content'),
      url: tag(block, 'link') || linkAttr || null,
      date: parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : new Date().toISOString(),
    });
  }
  return items;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function ddmmyyyy(d: Date): { dd: string; mm: string; yyyy: string } {
  return { dd: String(d.getUTCDate()).padStart(2, '0'), mm: String(d.getUTCMonth() + 1).padStart(2, '0'), yyyy: String(d.getUTCFullYear()) };
}

/** Diario Oficial de la Federación: daily notes from the SIDOF JSON service. */
export function parseDofNotes(payload: string): SourceItem[] {
  let data: unknown;
  try {
    data = JSON.parse(payload);
  } catch {
    return [];
  }
  const root = data as { NotasMatutinas?: unknown[]; NotasVespertinas?: unknown[]; notas?: unknown[] } | unknown[];
  const lists = Array.isArray(root) ? [root] : [root.NotasMatutinas ?? [], root.NotasVespertinas ?? [], root.notas ?? []];
  const out: SourceItem[] = [];
  for (const list of lists) {
    for (const raw of list as Array<Record<string, unknown>>) {
      const title = String(raw.titulo ?? raw.title ?? '').trim();
      if (!title) continue;
      const code = raw.codNota ?? raw.codigo ?? raw.id;
      const fecha = String(raw.fecha ?? raw.fechaPublicacion ?? '');
      const m = /(\d{2})[/-](\d{2})[/-](\d{4})/.exec(fecha);
      const iso = m ? `${m[3]}-${m[2]}-${m[1]}T00:00:00.000Z` : new Date().toISOString();
      out.push({
        title,
        body: String(raw.sinopsis ?? raw.resumen ?? ''),
        url: code ? `https://www.dof.gob.mx/nota_detalle.php?codigo=${String(code)}&fecha=${fecha}` : null,
        date: iso,
        kind: 'publicacion',
      });
    }
  }
  return out;
}

export const ADAPTERS: Adapter[] = [
  {
    id: 'mx-dof',
    name: 'Diario Oficial de la Federación',
    feedUrl: (d) => {
      const { dd, mm, yyyy } = ddmmyyyy(d);
      return `https://sidofqa.segob.gob.mx/sidof/notas/porDia/${dd}/${mm}/${yyyy}`;
    },
    parse: parseDofNotes,
    defaultKind: 'publicacion',
  },
  {
    id: 'mx-scjn',
    name: 'Suprema Corte de Justicia de la Nación (comunicados)',
    feedUrl: () => 'https://www.internet2.scjn.gob.mx/red2/comunicados/rss.aspx',
    parse: parseRss,
    defaultKind: 'comunicado',
  },
  {
    id: 'mx-pjf',
    name: 'Poder Judicial de la Federación (avisos)',
    feedUrl: () => 'https://www.cjf.gob.mx/rss/avisos.xml',
    parse: parseRss,
    defaultKind: 'aviso',
  },
];

export function getAdapter(id: string): Adapter | undefined {
  return ADAPTERS.find((a) => a.id === id);
}
