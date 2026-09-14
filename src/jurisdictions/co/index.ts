/** Colombia (plan § 11.3): SUIN-Juriscol con OData en datos.gov.co; relatoría de la Corte Constitucional. */
import type { Jurisdiction } from '../types';
import { DISCLAIMER_ES, makeCitationStyle } from '../_shared/citation';

export const CO_ENTITIES = [
  ['CO-DC', 'Bogotá, Distrito Capital'], ['CO-AMA', 'Amazonas'], ['CO-ANT', 'Antioquia'], ['CO-ARA', 'Arauca'],
  ['CO-ATL', 'Atlántico'], ['CO-BOL', 'Bolívar'], ['CO-BOY', 'Boyacá'], ['CO-CAL', 'Caldas'], ['CO-CAQ', 'Caquetá'],
  ['CO-CAS', 'Casanare'], ['CO-CAU', 'Cauca'], ['CO-CES', 'Cesar'], ['CO-CHO', 'Chocó'], ['CO-COR', 'Córdoba'],
  ['CO-CUN', 'Cundinamarca'], ['CO-GUA', 'Guainía'], ['CO-GUV', 'Guaviare'], ['CO-HUI', 'Huila'], ['CO-LAG', 'La Guajira'],
  ['CO-MAG', 'Magdalena'], ['CO-MET', 'Meta'], ['CO-NAR', 'Nariño'], ['CO-NSA', 'Norte de Santander'], ['CO-PUT', 'Putumayo'],
  ['CO-QUI', 'Quindío'], ['CO-RIS', 'Risaralda'], ['CO-SAP', 'San Andrés, Providencia y Santa Catalina'], ['CO-SAN', 'Santander'],
  ['CO-SUC', 'Sucre'], ['CO-TOL', 'Tolima'], ['CO-VAC', 'Valle del Cauca'], ['CO-VAU', 'Vaupés'], ['CO-VID', 'Vichada'],
] as const;

export const co: Jurisdiction = {
  code: 'co',
  name: 'Colombia',
  languages: ['es'],
  defaultLanguage: 'es',
  corpusScopes: ['co-nacional', ...CO_ENTITIES.map(([c]) => c.toLowerCase())],
  hierarchy: [
    { level: 1, name: 'Constitución Política de 1991 y bloque de constitucionalidad', examples: ['Constitución Política de Colombia'] },
    { level: 2, name: 'Leyes estatutarias y orgánicas', examples: ['Ley 1581 de 2012'] },
    { level: 3, name: 'Leyes ordinarias y códigos', examples: ['Código Sustantivo del Trabajo', 'Ley 1564 de 2012 (CGP)'] },
    { level: 4, name: 'Decretos', examples: ['Decreto 1072 de 2015'] },
    { level: 5, name: 'Resoluciones y circulares', examples: ['Resolución DIAN'] },
    { level: 6, name: 'Ordenanzas departamentales y acuerdos municipales', examples: ['Acuerdo del Concejo de Bogotá'] },
  ],
  entities: CO_ENTITIES.map(([code, name]) => ({ code, name })),
  sources: [
    { id: 'suin-juriscol', name: 'SUIN-Juriscol · Sistema Único de Información Normativa', kind: 'legislation', access: 'open-api', url: 'https://www.suin-juriscol.gov.co/', verifyUrl: 'https://www.suin-juriscol.gov.co/viewDocument.asp?id={id}', notes: 'Normas desde 1864 con vigencia y afectaciones; OData en datos.gov.co.' },
    { id: 'corte-constitucional', name: 'Corte Constitucional · Relatoría', kind: 'jurisprudence', access: 'open-download', url: 'https://www.corteconstitucional.gov.co/relatoria/', notes: 'Sentencias C, T y SU con texto completo.' },
    { id: 'consejo-estado', name: 'Consejo de Estado · Relatoría', kind: 'jurisprudence', access: 'open-download', url: 'https://www.consejodeestado.gov.co/' },
    { id: 'diario-oficial', name: 'Diario Oficial (Imprenta Nacional)', kind: 'gazette', access: 'open-download', url: 'https://www.imprenta.gov.co/' },
  ],
  citation: makeCitationStyle({
    language: 'es',
    constitution: 'Constitución Política',
    instrumentLead: String.raw`Ley|C[óo]digo|Decreto|Resoluci[óo]n|Constituci[óo]n|Acuerdo|Ordenanza`,
    extra: [
      { kind: 'law', regex: /\bLey\s+(\d{1,4}\s+de\s+\d{4})\b/gi },
      { kind: 'ruling', regex: /\bSentencia\s+((?:C|T|SU|A)-\d{1,4}\s+de\s+\d{4})\b/gi },
    ],
  }),
  legal: {
    privacyLaw: { name: 'Ley 1581 de 2012 (protección de datos personales)', url: 'https://www.suin-juriscol.gov.co/viewDocument.asp?ruta=Leyes/1683586' },
    dataAuthority: 'Superintendencia de Industria y Comercio',
    disclaimer: DISCLAIMER_ES,
  },
};
export default co;
