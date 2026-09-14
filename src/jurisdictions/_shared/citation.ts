/**
 * Fábrica de estilos de cita para jurisdicciones de habla hispana y
 * portuguesa. México conserva su propio estilo (tesis, registro digital);
 * los demás países parametrizan esta fábrica con su Constitución, sus
 * encabezados de instrumento y sus patrones de resolución.
 */
import type { CitationStyle, ParsedCitation } from '../types';

export interface ExtraPattern {
  /** `ruling`, `law`, `decree`… */
  kind: string;
  /** Regex global con el identificador en el grupo 1. */
  regex: RegExp;
}

export interface CitationFactoryOptions {
  language: 'es' | 'pt';
  /** Nombre canónico de la Constitución, p. ej. "Constitución Política de la República". */
  constitution: string;
  /** Encabezados de instrumento reconocidos en el texto (sin anclas). */
  instrumentLead: string;
  /** Patrones adicionales (resoluciones, leyes numeradas). */
  extra?: ExtraPattern[];
}

const SUFFIX_ES = String.raw`(?:bis|ter|qu[áa]ter|quinquies|sexies|septies|octies)`;
const NUM_ES = String.raw`(\d+(?:\s*[°º])?(?:\s+${SUFFIX_ES})?)`;
const NUM_PT = String.raw`(\d+(?:\s*[°ºo])?(?:-[A-Z])?)`;
const FEMININE_ES = /^(ley|constituci[óo]n|resoluci[óo]n|ordenanza|norma|circular|directiva|disposici[óo]n|carta|convenci[óo]n)/i;
const FEMININE_PT = /^(lei|constitui[çc][ãa]o|resolu[çc][ãa]o|portaria|medida|consolida[çc][ãa]o|clt|instru[çc][ãa]o|s[úu]mula|conven[çc][ãa]o)/i;

function normalizeNumber(raw: string): { number: string; suffix?: string } {
  const clean = raw.replace(/\s*[°ºo](?=\s|$)/g, '').replace(/\s+/g, ' ').trim();
  const m = /^(\d+(?:-[A-Z])?)\s+([a-záéíóú]+)$/i.exec(clean);
  if (!m) return { number: clean };
  const suffix = m[2]!;
  return { number: m[1]!, suffix: suffix.charAt(0).toUpperCase() + suffix.slice(1).toLowerCase() };
}

export function makeCitationStyle(opts: CitationFactoryOptions): CitationStyle {
  const pt = opts.language === 'pt';
  const articleWord = pt ? String.raw`\bart(?:igo|\.)\s*` : String.raw`\bart(?:[íi]culo|\.)\s*`;
  const connector = pt ? String.raw`(?:da|do|de\s+la)` : String.raw`(?:de\s+la|del|de\s+el|de)`;
  const number = pt ? NUM_PT : NUM_ES;
  const articleOf = new RegExp(
    String.raw`${articleWord}${number}(?:,?\s*(?:inciso|fracci[óo]n|numeral|literal|§|caput|par[áa]grafo|N[°º]?)\s*[^\s,;.]+)?,?\s+${connector}\s+((?:${opts.instrumentLead})[^.;,\n]{0,120}?)(?=[.;,\n)]|\s+(?:y|e|o|u)\s|$)`,
    'gi',
  );
  const constitutionRe = new RegExp(String.raw`^${opts.constitution.split(/\s+/)[0]}`, 'i');

  return {
    formatArticle({ number, suffix, instrument }) {
      const art = pt ? `art. ${number}${suffix ? ` ${suffix}` : ''}` : `Artículo ${number}${suffix ? ` ${suffix}` : ''}`;
      if (!instrument) return art;
      const feminine = (pt ? FEMININE_PT : FEMININE_ES).test(instrument);
      const link = pt ? (feminine ? 'da' : 'do') : feminine ? 'de la' : 'del';
      return `${art} ${link} ${instrument}`;
    },
    parse(text) {
      const out: ParsedCitation[] = [];
      for (const m of text.matchAll(articleOf)) {
        const instrument = m[2]!.trim();
        out.push({
          kind: constitutionRe.test(instrument) ? 'constitutional' : 'article',
          raw: m[0],
          ...normalizeNumber(m[1]!),
          instrument: constitutionRe.test(instrument) ? opts.constitution : instrument,
        });
      }
      for (const p of opts.extra ?? []) {
        for (const m of text.matchAll(p.regex)) {
          out.push({ kind: p.kind, raw: m[0], number: m[1]!.replace(/\s+/g, ' ').trim() });
        }
      }
      return out.sort((a, b) => text.indexOf(a.raw) - text.indexOf(b.raw));
    },
  };
}

/** Aviso estándar en español; cada país puede sustituirlo. */
export const DISCLAIMER_ES =
  'Esta respuesta es orientación general basada en la legislación citada; no constituye asesoría legal ni sustituye la consulta con un abogado. Verifica cada cita en la fuente oficial.';

export const DISCLAIMER_PT =
  'Esta resposta é orientação geral baseada na legislação citada; não constitui aconselhamento jurídico nem substitui a consulta a um advogado. Verifique cada citação na fonte oficial.';
