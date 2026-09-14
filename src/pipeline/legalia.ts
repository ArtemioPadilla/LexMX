/**
 * Conversor de snapshots de LegalIA (INGEOTEC, UNAM; Apache-2.0) a documentos
 * LexMX. Fase 6 del plan (docs/INCEPTOR-MIGRATION-ANALYSIS.md § 9.4 y § 11.3).
 *
 * LegalIA publica en GitHub Releases (`INGEOTEC/LegalIA`, tags `scjn-leyes`,
 * `scjn-reglamentos`, `scjn-lineamientos`) un tarball por instrumento con:
 *   <slug>/indice.json          — una entrada por snapshot (archivo, fecha, codNota…)
 *   <slug>/estado.json          — materia, vigencia, resumen (del buscador SCOW)
 *   <slug>/DD-MM-YYYY[-N].md    — texto consolidado tras cada reforma
 *   <slug>/notas/nota-<cod>.md  — decretos del DOF considerados
 * y un `indice-global.json.gz` con `instrumentos[slug] = {nombre, asset,
 * snapshots, materia, vigencia, resumen}`.
 *
 * Cada snapshot es Markdown ligero: cabecera `---` con `clave: valor`, y un
 * párrafo por bloque; "**Artículo N.**" abre un artículo, los encabezados de
 * estructura (Título, Capítulo, Sección) van como líneas sueltas, y
 * "## Transitorios" marca los transitorios. Este módulo es puro (sin I/O) para
 * poder probarlo con fixtures; el script `scripts/corpus/import-legalia.ts`
 * hace la descarga y la escritura.
 */

import type { DocumentType, LegalArea, LegalContent, LegalDocument, LegalHierarchy } from '../types/legal';

export interface SnapshotHeader {
  fuente?: string;
  ordenamiento?: string;
  fecha_publicacion?: string;
  fecha_expedicion?: string;
  categoria?: string;
  materia?: string;
  id_ordenamiento?: string;
  reforma_id?: string;
  [key: string]: string | undefined;
}

export interface InstrumentMeta {
  slug: string;
  nombre: string;
  materia?: string | null;
  vigencia?: string | null;
  resumen?: string | null;
  /** Fecha DD-MM-YYYY del snapshot más reciente. */
  fechaPublicacion?: string;
  /** Fecha DD-MM-YYYY del primer snapshot (publicación original). */
  fechaOriginal?: string;
  totalSnapshots?: number;
}

const HEADER_LINE = /^([a-z_]+):\s*(.*)$/;
const ORDINAL =
  '(?:[ÚU]nico|Primero|Segundo|Tercero|Cuarto|Quinto|Sexto|S[ée]ptimo|Octavo|Noveno|D[ée]cimo(?:\\s+(?:Primero|Segundo|Tercero|Cuarto|Quinto|Sexto|S[ée]ptimo|Octavo|Noveno))?)';
const NUMBER =
  '\\d+\\s*(?:o\\b\\.?|[°º])?\\s*(?:Bis|Ter|Qu[áa]ter|Quinquies|Sexies|Septies|Octies|Nonies|Decies)?';
// "**Artículo 47.**", "**Artículo 3° Bis.**", "**Primero.**" (transitorios), "**Artículo Primero.-**" (decretos)
const ARTICLE_LEAD = new RegExp(`^\\*\\*((?:Art[íi]culo\\s+)?(?:${NUMBER}|${ORDINAL})\\.?-?)\\*\\*\\s*(.*)$`, 'is');
const STRUCTURE_LEAD = /^(T[ÍI]TULO|CAP[ÍI]TULO|SECCI[ÓO]N|LIBRO|PARTE)\s+([\wÁÉÍÓÚÑáéíóúñ.]+)\s*(.*)$/i;
const LIST_MARKER = /^\*\*(?:[IVXLCDM]+|[a-z]|\d+)[.)]\*\*/i;
const TRANSITORIOS = /^##\s*Transitorios?\s*$/i;

/** Lee la cabecera `---` de un snapshot. */
export function parseSnapshotHeader(markdown: string): SnapshotHeader {
  const lines = markdown.split(/\r?\n/);
  const header: SnapshotHeader = {};
  if (lines[0]?.trim() !== '---') return header;
  for (const line of lines.slice(1)) {
    if (line.trim() === '---') break;
    const m = HEADER_LINE.exec(line);
    if (m) header[m[1]!] = m[2]!.trim();
  }
  return header;
}

/** Cuerpo del snapshot sin la cabecera. */
export function snapshotBody(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  if (lines[0]?.trim() !== '---') return markdown;
  const end = lines.findIndex((line, i) => i > 0 && line.trim() === '---');
  return end === -1 ? markdown : lines.slice(end + 1).join('\n');
}

/** "16-04-2025" → "2025-04-16". Devuelve la entrada si no coincide. */
export function isoDate(ddmmyyyy: string | undefined): string | undefined {
  if (!ddmmyyyy) return undefined;
  const m = /^(\d{2})-(\d{2})-(\d{4})/.exec(ddmmyyyy);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : ddmmyyyy;
}

function stripBold(text: string): string {
  return text.replace(/\*\*/g, '').trim();
}

/** "3 Bis" → "3-bis", "Único" → "unico": ids ASCII, sin acentos. */
function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const STRUCTURE_LABEL: Record<string, string> = {
  TITULO: 'Título',
  CAPITULO: 'Capítulo',
  SECCION: 'Sección',
  LIBRO: 'Libro',
  PARTE: 'Parte',
};

function normalizeArticleNumber(lead: string): string {
  return stripBold(lead)
    .replace(/^Art[íi]culo\s+/i, '')
    .replace(/\.?-?$/, '')
    .replace(/(\d)\s*(?:[°º]|o\.?)(?=\s|$)/gi, '$1')
    .replace(/\s+/g, ' ')
    .replace(/\b(bis|ter|qu[áa]ter|quinquies|sexies|septies|octies|nonies|decies)\b/gi, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .trim();
}

function titleCaseWords(text: string): string {
  return text
    .split(/\s+/)
    .map((word) => (/^[ivxlcdm]+$/i.test(word) ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()))
    .join(' ');
}

/**
 * Convierte el cuerpo Markdown en la lista jerárquica de `LegalContent` que
 * LexMX indexa: títulos/capítulos/secciones como contenedores y un elemento
 * por artículo, con `parent` apuntando al contenedor vigente. El preámbulo
 * (decreto, "Al margen un sello…") y las notas editoriales quedan fuera del
 * corpus indexable: no son texto normativo.
 */
export function parseSnapshotBody(body: string, docId: string): LegalContent[] {
  const paragraphs = body
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\r/g, '').trim())
    .filter(Boolean);

  const content: LegalContent[] = [];
  let currentParent: string | undefined;
  let currentArticle: LegalContent | undefined;
  let inTransitorios = false;
  let sawFirstArticle = false;
  const seen = new Map<string, number>();

  const uniqueId = (base: string): string => {
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base}-${n}`;
  };

  let lastWasContainer = false;

  for (const paragraph of paragraphs) {
    if (TRANSITORIOS.test(paragraph)) {
      inTransitorios = true;
      const id = uniqueId(`${docId}-transitorios`);
      content.push({ id, type: 'section', title: 'Transitorios', content: 'Transitorios' });
      currentParent = id;
      currentArticle = undefined;
      lastWasContainer = true;
      continue;
    }

    const article = !LIST_MARKER.test(paragraph) && ARTICLE_LEAD.exec(paragraph);
    if (article) {
      sawFirstArticle = true;
      const number = normalizeArticleNumber(article[1]!);
      const id = uniqueId(`${docId}-${inTransitorios ? 'trans' : 'art'}-${slugify(number)}`);
      const item: LegalContent = {
        id,
        type: 'article',
        number,
        title: `Artículo ${number}`,
        content: stripBold(article[2] ?? ''),
      };
      if (currentParent) item.parent = currentParent;
      content.push(item);
      currentArticle = item;
      lastWasContainer = false;
      continue;
    }

    const plain = stripBold(paragraph);
    const structure = STRUCTURE_LEAD.exec(plain);
    if (structure && plain.length < 200) {
      const kind = structure[1]!.toUpperCase();
      const type: LegalContent['type'] =
        kind.startsWith('T') || kind.startsWith('L') || kind.startsWith('P')
          ? 'title'
          : kind.startsWith('C')
            ? 'chapter'
            : 'section';
      const number = structure[2]!.replace(/\.$/, '');
      const word = STRUCTURE_LABEL[structure[1]!.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()] ?? structure[1]!;
      const label = `${word} ${titleCaseWords(number)}`;
      const rest = structure[3]?.trim();
      const id = uniqueId(`${docId}-${type}-${slugify(number)}`);
      content.push({ id, type, number, title: label, content: rest ? `${label}: ${rest}` : label });
      currentParent = id;
      currentArticle = undefined;
      lastWasContainer = true;
      continue;
    }

    // Caption right after a structure header ("Disposiciones Generales") names the container.
    if (lastWasContainer && currentParent && plain.length < 200) {
      const container = content.find((c) => c.id === currentParent);
      if (container && container.content === container.title) {
        container.content = `${container.title}: ${plain}`;
      }
      continue;
    }

    // Continuation paragraph: fractions, incisos, párrafos of the current article.
    if (currentArticle && sawFirstArticle) {
      currentArticle.content = currentArticle.content ? `${currentArticle.content}\n\n${plain}` : plain;
    }
  }

  // Attach children lists for containers.
  const children = new Map<string, string[]>();
  for (const item of content) {
    if (item.parent) children.set(item.parent, [...(children.get(item.parent) ?? []), item.id]);
  }
  for (const item of content) {
    const kids = children.get(item.id);
    if (kids) item.children = kids;
  }
  return content;
}

const AREA_BY_MATERIA: Array<[RegExp, LegalArea]> = [
  [/CONSTITUCIONAL/i, 'constitutional'],
  [/DERECHOS HUMANOS/i, 'human-rights'],
  [/LABORAL|SEGURIDAD SOCIAL|TRABAJO/i, 'labor'],
  [/FISCAL|TRIBUTARI|HACIENDA|IMPUESTO/i, 'tax'],
  [/PENAL/i, 'criminal'],
  [/MERCANTIL|COMERCI|BANCAR|FINANCIER/i, 'commercial'],
  [/FAMILIA/i, 'family'],
  [/CIVIL/i, 'civil'],
  [/AMBIENT|ECOL/i, 'environmental'],
  [/MIGRA/i, 'migration'],
  [/PROPIEDAD|AGRARI|INMOBILIARI/i, 'property'],
  [/ADMINISTRATIV/i, 'administrative'],
];

/** Materia del buscador SCOW ("SEGURIDAD SOCIAL, LABORAL") → LegalArea de LexMX. */
export function areaFromMateria(materia: string | null | undefined, nombre = ''): LegalArea {
  const haystack = `${materia ?? ''} ${nombre}`;
  for (const [pattern, area] of AREA_BY_MATERIA) {
    if (pattern.test(haystack)) return area;
  }
  return 'administrative';
}

/**
 * Tipo y jerarquía. El NOMBRE del instrumento manda ("LEY…", "CÓDIGO…"): la
 * `categoria` de la cabecera describe la reforma más reciente (DECRETO,
 * ACUERDO, FE DE ERRATAS…), no el instrumento, y solo se usa si el nombre
 * no es concluyente.
 */
export function typeFromName(nombre: string, categoria?: string): { type: DocumentType; hierarchy: LegalHierarchy } {
  const classify = (text: string): { type: DocumentType; hierarchy: LegalHierarchy } | undefined => {
    const head = text.toUpperCase().trim();
    if (/^CONSTITUCI[ÓO]N\b/.test(head)) return { type: 'constitution', hierarchy: 1 };
    if (/^C[ÓO]DIGO\b/.test(head)) return { type: 'code', hierarchy: 3 };
    if (/^REGLAMENTO\b/.test(head)) return { type: 'regulation', hierarchy: 4 };
    if (/^(NOM\b|NORMA OFICIAL)/.test(head)) return { type: 'norm', hierarchy: 5 };
    if (/^(TRATADO|CONVENI|PROTOCOLO)/.test(head)) return { type: 'treaty', hierarchy: 2 };
    if (/^LEY\b/.test(head)) return { type: 'law', hierarchy: 3 };
    if (/^(LINEAMIENTO|ACUERDO|MANUAL|FORMATO|ESTATUTO|DISPOSICI)/.test(head)) return { type: 'format', hierarchy: 7 };
    if (/^DECRETO\b/.test(head)) return undefined; // a reform's category, never an instrument type
    return undefined;
  };
  return classify(nombre) ?? (categoria ? classify(categoria) : undefined) ?? { type: 'law', hierarchy: 3 };
}

/** "VIGENTE" | "ABROGADO" | "DEROGADO" | "SIN EFECTO" | … → estado LexMX. */
export function statusFromVigencia(vigencia: string | null | undefined): LegalDocument['status'] {
  const v = (vigencia ?? '').toUpperCase();
  if (!v || v === 'VIGENTE') return 'active';
  if (/ABROGAD|DEROGAD|EXTINGUID|INEFICAZ|NO VIGENTE/.test(v)) return 'repealed';
  return 'suspended';
}

/** Título con mayúsculas de la SCJN ("LEY Federal del Trabajo") → "Ley Federal del Trabajo". */
export function humanizeTitle(nombre: string): string {
  return nombre.replace(/^([A-ZÁÉÍÓÚÑ]{2,})(\s|$)/, (_, word: string, sep: string) => {
    const lower = word.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1) + sep;
  });
}

/**
 * Construye el `LegalDocument` de LexMX a partir de un snapshot (el más
 * reciente = texto vigente) y los metadatos del instrumento.
 */
export function toLegalDocument(meta: InstrumentMeta, snapshotMarkdown: string): LegalDocument {
  const header = parseSnapshotHeader(snapshotMarkdown);
  const body = snapshotBody(snapshotMarkdown);
  const nombre = meta.nombre || header.ordenamiento || meta.slug;
  const { type, hierarchy } = typeFromName(nombre, header.categoria);
  const primaryArea = areaFromMateria(meta.materia ?? header.materia, nombre);
  const content = parseSnapshotBody(body, meta.slug);
  const fullText = content
    .filter((c) => c.type === 'article')
    .map((c) => `${c.title}. ${c.content}`)
    .join('\n\n');
  const publicationDate = isoDate(meta.fechaOriginal ?? header.fecha_publicacion) ?? '';
  const lastReform = isoDate(meta.fechaPublicacion ?? header.fecha_publicacion);

  const doc: LegalDocument = {
    id: meta.slug,
    title: humanizeTitle(nombre),
    shortTitle: meta.slug.toUpperCase(),
    type,
    hierarchy,
    primaryArea,
    secondaryAreas: [],
    authority: type === 'constitution' ? 'Constituyente / Congreso de la Unión' : 'Congreso de la Unión',
    publicationDate,
    status: statusFromVigencia(meta.vigencia),
    territorialScope: 'federal',
    applicability: meta.resumen?.trim() || `Legislación federal: ${humanizeTitle(nombre)}`,
    content,
    fullText,
    officialUrl: header.id_ordenamiento
      ? `https://legislacion.scjn.gob.mx/consulta/buscador?idOrdenamiento=${header.id_ordenamiento}`
      : 'https://legislacion.scjn.gob.mx/consulta/buscador',
    relatedDependencies: [],
    importance: hierarchy <= 3 ? 'high' : 'medium',
    updateFrequency: (meta.totalSnapshots ?? 1) > 40 ? 'high' : (meta.totalSnapshots ?? 1) > 10 ? 'medium' : 'low',
  };
  if (lastReform) doc.lastReform = lastReform;
  doc.lastUpdated = new Date().toISOString();
  doc.version = header.reforma_id ? `reforma-${header.reforma_id}` : undefined;
  return doc;
}

/** Entrada de `metadata.json` / `index.json` del corpus público de LexMX. */
export function corpusIndexEntry(doc: LegalDocument, sizeBytes: number) {
  return {
    id: doc.id,
    title: doc.title,
    type: doc.type,
    primaryArea: doc.primaryArea,
    hierarchy: doc.hierarchy,
    status: doc.status,
    lastReform: doc.lastReform ?? null,
    jurisdiction: 'mx-federal',
    source: 'legalia:scjn-leyes',
    size: sizeBytes,
    lastUpdated: doc.lastUpdated ?? '',
    url: `/legal-corpus/${doc.id}.json`,
  };
}
