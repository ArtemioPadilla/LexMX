/**
 * México: jurisdicción de referencia (plan § 11.2 y § 11.3).
 */
import type { CitationStyle, Jurisdiction, ParsedCitation } from '../types';
import { mxCalculators } from './calculators';

export const MX_ENTITIES = [
  ['MX-AGU', 'Aguascalientes'],
  ['MX-BCN', 'Baja California'],
  ['MX-BCS', 'Baja California Sur'],
  ['MX-CAM', 'Campeche'],
  ['MX-CHP', 'Chiapas'],
  ['MX-CHH', 'Chihuahua'],
  ['MX-CMX', 'Ciudad de México'],
  ['MX-COA', 'Coahuila de Zaragoza'],
  ['MX-COL', 'Colima'],
  ['MX-DUR', 'Durango'],
  ['MX-GUA', 'Guanajuato'],
  ['MX-GRO', 'Guerrero'],
  ['MX-HID', 'Hidalgo'],
  ['MX-JAL', 'Jalisco'],
  ['MX-MEX', 'Estado de México'],
  ['MX-MIC', 'Michoacán de Ocampo'],
  ['MX-MOR', 'Morelos'],
  ['MX-NAY', 'Nayarit'],
  ['MX-NLE', 'Nuevo León'],
  ['MX-OAX', 'Oaxaca'],
  ['MX-PUE', 'Puebla'],
  ['MX-QUE', 'Querétaro'],
  ['MX-ROO', 'Quintana Roo'],
  ['MX-SLP', 'San Luis Potosí'],
  ['MX-SIN', 'Sinaloa'],
  ['MX-SON', 'Sonora'],
  ['MX-TAB', 'Tabasco'],
  ['MX-TAM', 'Tamaulipas'],
  ['MX-TLA', 'Tlaxcala'],
  ['MX-VER', 'Veracruz de Ignacio de la Llave'],
  ['MX-YUC', 'Yucatán'],
  ['MX-ZAC', 'Zacatecas'],
] as const;

const ARTICLE = String.raw`(\d+(?:\s*[°º])?(?:\s+(?:Bis|Ter|Qu[áa]ter|Quinquies|Sexies|Septies|Octies|Nonies|Decies))?)`;
const CONSTITUTIONAL = new RegExp(String.raw`\bart[íi]culo\s+${ARTICLE}\s+constitucional\b`, 'gi');
const ARTICLE_OF = new RegExp(
  String.raw`\bart[íi]culo\s+${ARTICLE}\s+(?:de\s+la|del|de\s+el)\s+((?:Ley|C[óo]digo|Reglamento|Constituci[óo]n)[^.;,\n]{3,120}?)(?=[.;,\n]|\s+(?:y|e|o|u)\s|$)`,
  'gi',
);
const THESIS = /\b(?:tesis|jurisprudencia)\s+((?:[1-2]a\.|P\.|I\.|[IVX]+\.)\s*(?:\/J\.)?\s*\d+\/\d{4})/gi;
const REGISTRO = /\bregistro(?:\s+digital)?\s*:?\s*(\d{6,7})\b/gi;

function normalizeSuffix(number: string): { number: string; suffix?: string } {
  const clean = number.replace(/\s*[°º]/g, '').replace(/\s+/g, ' ').trim();
  const m = /^(\d+)\s+(\w+)$/.exec(clean);
  if (!m) return { number: clean };
  const suffix = m[2]!;
  return { number: m[1]!, suffix: suffix.charAt(0).toUpperCase() + suffix.slice(1).toLowerCase() };
}

export const mxCitation: CitationStyle = {
  formatArticle({ number, suffix, instrument }) {
    const article = `Artículo ${number}${suffix ? ` ${suffix}` : ''}`;
    if (!instrument) return article;
    if (/^constituci[óo]n/i.test(instrument)) return `${article} constitucional`;
    const connector = /^(Ley|Constituci[óo]n)/i.test(instrument) ? 'de la' : 'del';
    return `${article} ${connector} ${instrument}`;
  },
  parse(text) {
    const out: ParsedCitation[] = [];
    for (const m of text.matchAll(CONSTITUTIONAL)) {
      out.push({ kind: 'constitutional', raw: m[0], ...normalizeSuffix(m[1]!), instrument: 'Constitución Política de los Estados Unidos Mexicanos' });
    }
    for (const m of text.matchAll(ARTICLE_OF)) {
      out.push({ kind: 'article', raw: m[0], ...normalizeSuffix(m[1]!), instrument: m[2]!.trim() });
    }
    for (const m of text.matchAll(THESIS)) {
      out.push({ kind: 'thesis', raw: m[0], number: m[1]!.replace(/\s+/g, ' ').trim() });
    }
    for (const m of text.matchAll(REGISTRO)) {
      out.push({ kind: 'registro', raw: m[0], number: m[1]! });
    }
    return out.sort((a, b) => text.indexOf(a.raw) - text.indexOf(b.raw));
  },
};

export const mx: Jurisdiction = {
  code: 'mx',
  name: 'México',
  languages: ['es', 'en'],
  defaultLanguage: 'es',
  corpusScopes: ['mx-federal', ...MX_ENTITIES.map(([code]) => code.toLowerCase())],
  hierarchy: [
    { level: 1, name: 'Constitución', examples: ['Constitución Política de los Estados Unidos Mexicanos'] },
    { level: 2, name: 'Tratados internacionales', examples: ['Convención Americana sobre Derechos Humanos'] },
    { level: 3, name: 'Leyes y códigos federales', examples: ['Ley Federal del Trabajo', 'Código Civil Federal'] },
    { level: 4, name: 'Reglamentos', examples: ['Reglamento de la Ley Federal del Trabajo'] },
    { level: 5, name: 'Normas Oficiales Mexicanas', examples: ['NOM-035-STPS-2018'] },
    { level: 6, name: 'Leyes estatales', examples: ['Código Civil para el Distrito Federal'] },
    { level: 7, name: 'Formatos y disposiciones administrativas', examples: ['Lineamientos del SAT'] },
  ],
  entities: MX_ENTITIES.map(([code, name]) => ({ code, name })),
  sources: [
    {
      id: 'scjn-scow',
      name: 'SCJN · Legislación (API SCOW)',
      kind: 'legislation',
      access: 'open-api',
      url: 'https://legislacion.scjn.gob.mx/',
      verifyUrl: 'https://legislacion.scjn.gob.mx/consulta/buscador?idOrdenamiento={id}',
      notes: 'Texto vigente por reforma, materia y vigencia por ordenamiento. Consumido vía los releases de LegalIA (INGEOTEC, UNAM).',
    },
    {
      id: 'diputados-leyesbiblio',
      name: 'Cámara de Diputados · Leyes federales vigentes',
      kind: 'legislation',
      access: 'open-download',
      url: 'https://www.diputados.gob.mx/LeyesBiblio/',
      verifyUrl: 'https://www.diputados.gob.mx/LeyesBiblio/pdf/{id}.pdf',
    },
    {
      id: 'sjf',
      name: 'Semanario Judicial de la Federación (tesis y jurisprudencia)',
      kind: 'jurisprudence',
      access: 'open-download',
      url: 'https://sjf2.scjn.gob.mx/',
      verifyUrl: 'https://sjf2.scjn.gob.mx/detalle/tesis/{id}',
      notes: 'Descarga en formatos abiertos (CSV y JSON) desde el repositorio de la SCJN; el registro digital identifica cada tesis.',
    },
    {
      id: 'sidof',
      name: 'Diario Oficial de la Federación (SIDOF)',
      kind: 'gazette',
      access: 'open-api',
      url: 'https://sidof.segob.gob.mx/',
      verifyUrl: 'https://sidof.segob.gob.mx/notas/{id}',
      notes: 'Datos abiertos JSON: notas por fecha y detalle por codNota; base para detectar reformas.',
    },
    {
      id: 'sat',
      name: 'SAT · Resolución Miscelánea Fiscal y criterios',
      kind: 'fiscal',
      access: 'scraping',
      url: 'https://www.sat.gob.mx/',
      notes: 'Oleada fiscal de la Fase 6; sin API abierta.',
    },
  ],
  citation: mxCitation,
  calculators: mxCalculators,
  legal: {
    privacyLaw: {
      name: 'Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP)',
      url: 'https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPDPPP.pdf',
    },
    dataAuthority: 'INAI',
    disclaimer:
      'Esta respuesta es orientación general basada en la legislación citada; no constituye asesoría legal ni sustituye la consulta con un abogado. Verifica cada cita en la fuente oficial.',
  },
};

export default mx;
