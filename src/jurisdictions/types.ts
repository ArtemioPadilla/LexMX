/**
 * Jurisdicción como dimensión de primer nivel (plan § 11.2).
 *
 * Cada país (y, dentro de él, cada entidad subnacional) se describe con este
 * contrato. Nada específico de un país vive fuera de `src/jurisdictions/<cc>/`:
 * fuentes, jerarquía normativa, formato y parser de citas, calculadoras,
 * marco legal aplicable y entidades. Añadir un país es añadir un módulo, no
 * reescribir el núcleo.
 */

export type JurisdictionCode = 'mx' | 'cl' | 'ar' | 'co' | 'pe' | 'br' | 'uy' | 'ec' | 'cr' | 'pa';

export type Language = 'es' | 'pt' | 'en';

export interface HierarchyLevel {
  /** 1 = norma suprema. Coincide con `LegalHierarchy` y con la paleta `hierarchy-N`. */
  level: number;
  /** Nombre corto en el idioma principal de la jurisdicción. */
  name: string;
  /** Ejemplos reales para la UI y para los prompts. */
  examples: string[];
}

export interface SubnationalEntity {
  /** ISO 3166-2 (p. ej. `MX-JAL`) o el código oficial local. */
  code: string;
  name: string;
}

export interface LegalSource {
  id: string;
  name: string;
  kind: 'legislation' | 'jurisprudence' | 'gazette' | 'fiscal' | 'other';
  /** Cómo se accede: API abierta, descarga abierta, scraping o licencia. */
  access: 'open-api' | 'open-download' | 'scraping' | 'licensed';
  url: string;
  /** Patrón de enlace de verificación por documento, con `{id}`. */
  verifyUrl?: string;
  notes?: string;
}

export interface ParsedCitation {
  /** `article`, `thesis`, `constitutional`, `regulation`… */
  kind: string;
  /** Texto original tal como apareció. */
  raw: string;
  /** Número de artículo o de tesis. */
  number?: string;
  /** Nombre del instrumento (ley, código) cuando aparece. */
  instrument?: string;
  /** Sufijos como Bis, Ter. */
  suffix?: string;
}

export interface CitationStyle {
  /** Da formato canónico a una cita de artículo. */
  formatArticle(input: { number: string; suffix?: string; instrument?: string }): string;
  /** Extrae todas las citas reconocibles de un texto. */
  parse(text: string): ParsedCitation[];
}

export interface LegalFramework {
  /** Ley de protección de datos aplicable al usuario. */
  privacyLaw: { name: string; url?: string };
  /** Texto del aviso que acompaña cada respuesta. */
  disclaimer: string;
  /** Autoridad de protección de datos. */
  dataAuthority?: string;
}

export interface Jurisdiction {
  code: JurisdictionCode;
  name: string;
  languages: Language[];
  defaultLanguage: Language;
  /** Id usado en shards y metadatos: `mx-federal`, `mx-jal`, `cl-nacional`… */
  corpusScopes: string[];
  hierarchy: HierarchyLevel[];
  entities: SubnationalEntity[];
  sources: LegalSource[];
  citation: CitationStyle;
  legal: LegalFramework;
}
