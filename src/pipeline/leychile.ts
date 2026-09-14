/**
 * Chile adapter for the corpus pipeline (plan § 11.4 B, second wave):
 * converts the XML that the Biblioteca del Congreso Nacional serves for a
 * norm (`https://www.leychile.cl/Consulta/obtxml?opt=7&idNorma=<id>`) into
 * the same `LegalDocument` the Mexican pipeline produces, so the client,
 * the embeddings build and the benchmark need no country-specific code.
 *
 * Pure (no I/O). The XML is walked with a small tokenizer instead of a DOM so
 * it runs in Node scripts and in tests alike. Unknown parts of the schema are
 * ignored rather than failing: a law with an odd structure still yields its
 * articles.
 */
import type { LegalArea, LegalContent, LegalDocument, LegalHierarchy, DocumentType } from '@/types/legal';

export interface LeyChileNorm {
  id: string;
  title: string;
  kind: string;
  number: string;
  publicationDate: string;
  versionDate: string;
  derogated: boolean;
  organisms: string[];
  subjects: string[];
  content: LegalContent[];
}

interface Node {
  tag: string;
  attrs: Record<string, string>;
  children: Node[];
  text: string;
}

/** Minimal XML → tree. Handles CDATA, entities, self-closing tags; no namespaces or DTDs. */
export function parseXml(xml: string): Node {
  const root: Node = { tag: '#root', attrs: {}, children: [], text: '' };
  const stack: Node[] = [root];
  const re = /<!\[CDATA\[([\s\S]*?)\]\]>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<\/([\w:.-]+)\s*>|<([\w:.-]+)((?:\s+[\w:.-]+\s*=\s*"[^"]*")*)\s*(\/?)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const cur = stack[stack.length - 1]!;
    if (m[1] !== undefined) {
      cur.text += m[1];
    } else if (m[2]) {
      if (stack.length > 1) stack.pop();
    } else if (m[3]) {
      const attrs: Record<string, string> = {};
      for (const a of (m[4] ?? '').matchAll(/([\w:.-]+)\s*=\s*"([^"]*)"/g)) attrs[a[1]!] = decode(a[2]!);
      const node: Node = { tag: m[3], attrs, children: [], text: '' };
      cur.children.push(node);
      if (!m[5]) stack.push(node);
    } else if (m[6] !== undefined) {
      cur.text += decode(m[6]);
    }
  }
  return root;
}

function decode(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&');
}

function find(node: Node, tag: string): Node | undefined {
  for (const c of node.children) {
    if (c.tag === tag) return c;
    const deep = find(c, tag);
    if (deep) return deep;
  }
  return undefined;
}

function findAll(node: Node, tag: string, out: Node[] = []): Node[] {
  for (const c of node.children) {
    if (c.tag === tag) out.push(c);
    findAll(c, tag, out);
  }
  return out;
}

/**
 * LeyChile lays each article out in two columns: the text on the left and
 * modification references on the right ("LEY N° 19.611 Art. único D.O.
 * 16.06.1999"), separated by runs of spaces. Drops the right column: any
 * run of 3+ spaces after text ends the line, and lines that are only a
 * note (indented 15+ columns) go away. Paragraph indents (5 spaces) survive.
 */
export function stripMarginNotes(raw: string): string {
  return raw
    .split('\n')
    .map((line) => {
      const lead = /^[ \t]*/.exec(line)![0].length;
      if (lead >= 15) return '';
      const body = line.slice(lead);
      const cut = body.search(/ {3,}\S/);
      return cut > 0 ? body.slice(0, cut) : body;
    })
    .filter((line, i, arr) => line.trim() !== '' || (arr[i - 1] ?? '').trim() !== '')
    .join('\n');
}

function textOf(node: Node | undefined): string {
  if (!node) return '';
  const own = node.tag === 'Texto' ? stripMarginNotes(node.text) : node.text;
  return (own + node.children.map(textOf).join(' ')).replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
}

// "Artículo 1.-", "Art. 2º.-", "Artículo 1.o", "Art.2.o", "Artículo 12 bis.-", "Artículo único.-".
const ARTICLE_LEAD =
  /^\s*Art(?:[íi]culo|\.)?\s*(\d+|[úu]nico|primero|segundo|tercero|cuarto|quinto|sexto|s[ée]ptimo|octavo|noveno|d[ée]cimo)(?:\s*\.?\s*[oº°](?![a-z]))?(?:\s*(bis|ter|qu[áa]ter|quinquies|sexies)\b)?(?:\s*\.?\s*[oº°](?![a-z]))?\s*[.:-]*\s*/iu;

/** "Artículo 12 bis.-" → "12 bis"; "Artículo 3º bis.-" → "3 bis"; "Artículo único." → "único". */
export function articleNumber(text: string): string | null {
  const m = ARTICLE_LEAD.exec(text);
  if (!m) return null;
  const base = m[1]!.trim().toLowerCase();
  return m[2] ? `${base} ${m[2].toLowerCase()}` : base;
}

function slug(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** Walks EstructuraFuncional nodes into LegalContent (títulos/capítulos as containers, artículos as leaves). */
export function parseStructures(root: Node, docId: string): LegalContent[] {
  const out: LegalContent[] = [];
  const seen = new Map<string, number>();
  const uid = (base: string) => {
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base}-${n}`;
  };
  let inTransitory = false;

  const walk = (node: Node, parent: string | undefined) => {
    for (const child of node.children) {
      if (child.tag !== 'EstructuraFuncional') {
        walk(child, parent);
        continue;
      }
      const kind = (child.attrs.tipoParte ?? '').toLowerCase();
      const own = textOf(child.children.find((c) => c.tag === 'Texto'));
      if (/transitori/.test(kind) || /^\s*(disposiciones|art[íi]culos)\s+transitori/i.test(own)) inTransitory = true;
      if ((/^art[íi]culo\b/.test(kind) && !/^art[íi]culos/.test(kind)) || /^disposici[óo]n transitoria/.test(kind)) {
        const number = articleNumber(own) ?? String(out.filter((c) => c.type === 'article').length + 1);
        const id = uid(`${docId}-${inTransitory ? 'trans' : 'art'}-${slug(number)}`);
        const body = own.replace(ARTICLE_LEAD, '').trim();
        const item: LegalContent = { id, type: 'article', number, title: `Artículo ${number}`, content: body };
        if (inTransitory || child.attrs.transitorio === 'transitorio') item.transitory = true;
        if (parent) item.parent = parent;
        out.push(item);
        // A decree that "fixes" a code nests the whole code under one of its
        // articles (Código Civil, DFL 1/2000): keep walking.
        walk(child, parent);
        continue;
      }
      const type: LegalContent['type'] = /t[íi]tulo|libro/.test(kind) ? 'title' : /cap[íi]tulo/.test(kind) ? 'chapter' : 'section';
      const heading = own.split('\n')[0]?.slice(0, 160) || child.attrs.tipoParte || kind;
      const id = uid(`${docId}-${type}-${slug(heading).slice(0, 48) || 'x'}`);
      const container: LegalContent = { id, type, title: heading, content: heading, children: [] };
      if (parent) container.parent = parent;
      out.push(container);
      const before = out.length;
      walk(child, id);
      container.children = out.slice(before).filter((c) => c.parent === id).map((c) => c.id);
    }
  };
  walk(root, undefined);
  return out;
}

export function parseLeyChile(xml: string): LeyChileNorm {
  const root = parseXml(xml);
  const norma = find(root, 'Norma') ?? root;
  const tipoNumero = find(norma, 'TipoNumero');
  const meta = find(norma, 'Metadatos');
  const id = norma.attrs.normaId ?? norma.attrs.idNorma ?? '';
  const kind = textOf(find(tipoNumero ?? norma, 'Tipo'));
  const number = textOf(find(tipoNumero ?? norma, 'Numero'));
  const title = textOf(find(meta ?? norma, 'TituloNorma')) || `${kind} ${number}`.trim();
  return {
    id,
    title,
    kind,
    number,
    publicationDate: norma.attrs.fechaPublicacion ?? '',
    versionDate: norma.attrs.fechaVersion ?? '',
    derogated: /^(true|1|s[íi])$/i.test(norma.attrs.derogado ?? ''),
    organisms: findAll(norma, 'Organismo').map(textOf).filter(Boolean),
    subjects: findAll(meta ?? norma, 'Materia').map(textOf).filter(Boolean),
    content: parseStructures(norma, `cl-${id || slug(title)}`),
  };
}

const AREA_BY_SUBJECT: Array<[RegExp, LegalArea]> = [
  [/trabajo|laboral|empleo/i, 'labor'],
  [/tribut|impuesto|renta|iva/i, 'tax'],
  [/penal|delito/i, 'criminal'],
  [/comerc|sociedad|mercant/i, 'commercial'],
  [/constitu/i, 'constitutional'],
  [/administra|estado|p[úu]blic/i, 'administrative'],
];

export function areaFromSubjects(subjects: string[], title: string): LegalArea {
  const hay = [...subjects, title].join(' ');
  for (const [re, area] of AREA_BY_SUBJECT) if (re.test(hay)) return area;
  return 'civil';
}

export function typeFromKind(kind: string, title: string): { type: DocumentType; hierarchy: LegalHierarchy } {
  const k = `${kind} ${title}`.toLowerCase();
  if (/constituci/.test(k)) return { type: 'constitution', hierarchy: 1 };
  if (/c[óo]digo/.test(k)) return { type: 'code', hierarchy: 3 };
  if (/decreto con fuerza de ley|dfl|decreto ley/.test(k)) return { type: 'law', hierarchy: 3 };
  if (/reglamento|decreto/.test(k)) return { type: 'regulation', hierarchy: 4 };
  return { type: 'law', hierarchy: 3 };
}

/** LeyChile norm → LexMX corpus document (jurisdiction 'cl'). */
export function toLegalDocumentCl(norm: LeyChileNorm, docId?: string, title?: string): LegalDocument {
  const id = docId ?? `cl-${norm.id || slug(norm.title)}`;
  const content = norm.content.map((c) => ({ ...c, id: c.id.replace(/^cl-[^-]+/, id), parent: c.parent?.replace(/^cl-[^-]+/, id), children: c.children?.map((x) => x.replace(/^cl-[^-]+/, id)) }));
  const { type, hierarchy } = typeFromKind(norm.kind, norm.title);
  const articles = content.filter((c) => c.type === 'article');
  const doc: LegalDocument = {
    id,
    title: title ?? norm.title,
    shortTitle: `${norm.kind} ${norm.number}`.trim().toUpperCase(),
    type,
    hierarchy,
    primaryArea: areaFromSubjects(norm.subjects, norm.title),
    secondaryAreas: [],
    authority: norm.organisms[0] ?? 'Congreso Nacional de Chile',
    publicationDate: norm.publicationDate,
    status: norm.derogated ? 'repealed' : 'active',
    territorialScope: 'federal',
    jurisdiction: 'cl',
    applicability: `Legislación nacional de Chile: ${title ?? norm.title}`,
    content,
    fullText: articles.map((c) => `${c.title}. ${c.content}`).join('\n\n'),
    officialUrl: norm.id ? `https://www.bcn.cl/leychile/navegar?idNorma=${norm.id}` : 'https://www.bcn.cl/leychile',
    relatedDependencies: [],
    importance: hierarchy <= 3 ? 'high' : 'medium',
    updateFrequency: 'medium',
  };
  if (norm.versionDate) doc.lastReform = norm.versionDate;
  doc.lastUpdated = new Date().toISOString();
  return doc;
}
