/** Perú (plan § 11.3): SPIJ (parte libre) y datosabiertos.gob.pe; Tribunal Constitucional. */
import type { Jurisdiction } from '../types';
import { DISCLAIMER_ES, makeCitationStyle } from '../_shared/citation';

export const PE_ENTITIES = [
  ['PE-AMA', 'Amazonas'], ['PE-ANC', 'Áncash'], ['PE-APU', 'Apurímac'], ['PE-ARE', 'Arequipa'], ['PE-AYA', 'Ayacucho'],
  ['PE-CAJ', 'Cajamarca'], ['PE-CAL', 'Callao'], ['PE-CUS', 'Cusco'], ['PE-HUV', 'Huancavelica'], ['PE-HUC', 'Huánuco'],
  ['PE-ICA', 'Ica'], ['PE-JUN', 'Junín'], ['PE-LAL', 'La Libertad'], ['PE-LAM', 'Lambayeque'], ['PE-LIM', 'Lima'],
  ['PE-LMA', 'Lima Metropolitana'], ['PE-LOR', 'Loreto'], ['PE-MDD', 'Madre de Dios'], ['PE-MOQ', 'Moquegua'], ['PE-PAS', 'Pasco'],
  ['PE-PIU', 'Piura'], ['PE-PUN', 'Puno'], ['PE-SAM', 'San Martín'], ['PE-TAC', 'Tacna'], ['PE-TUM', 'Tumbes'], ['PE-UCA', 'Ucayali'],
] as const;

export const pe: Jurisdiction = {
  code: 'pe',
  name: 'Perú',
  languages: ['es'],
  defaultLanguage: 'es',
  corpusScopes: ['pe-nacional', ...PE_ENTITIES.map(([c]) => c.toLowerCase())],
  hierarchy: [
    { level: 1, name: 'Constitución Política de 1993', examples: ['Constitución Política del Perú'] },
    { level: 2, name: 'Tratados internacionales', examples: ['Convención Americana sobre Derechos Humanos'] },
    { level: 3, name: 'Leyes y decretos legislativos', examples: ['Ley N.° 29733', 'Decreto Legislativo N.° 728', 'Código Civil'] },
    { level: 4, name: 'Decretos supremos y reglamentos', examples: ['Decreto Supremo N.° 003-97-TR'] },
    { level: 5, name: 'Resoluciones', examples: ['Resolución de Superintendencia SUNAT'] },
    { level: 6, name: 'Ordenanzas regionales y municipales', examples: ['Ordenanza de la Municipalidad de Lima'] },
  ],
  entities: PE_ENTITIES.map(([code, name]) => ({ code, name })),
  sources: [
    { id: 'spij', name: 'SPIJ · Sistema Peruano de Información Jurídica', kind: 'legislation', access: 'licensed', url: 'https://spij.minjus.gob.pe/', notes: 'Parte libre y parte con licencia de pago; relevar qué queda fuera de la parte libre.' },
    { id: 'datos-abiertos', name: 'Plataforma Nacional de Datos Abiertos', kind: 'legislation', access: 'open-download', url: 'https://www.datosabiertos.gob.pe/', notes: 'Datasets de normas y jurisprudencia publicados desde 2023.' },
    { id: 'tc', name: 'Tribunal Constitucional · Jurisprudencia', kind: 'jurisprudence', access: 'open-download', url: 'https://www.tc.gob.pe/jurisprudencia/', notes: 'Sentencias y precedentes vinculantes.' },
    { id: 'el-peruano', name: 'Diario Oficial El Peruano', kind: 'gazette', access: 'open-download', url: 'https://busquedas.elperuano.pe/' },
  ],
  citation: makeCitationStyle({
    language: 'es',
    constitution: 'Constitución Política del Perú',
    instrumentLead: String.raw`Ley|C[óo]digo|Decreto|Resoluci[óo]n|Constituci[óo]n|Ordenanza`,
    extra: [
      { kind: 'law', regex: /\bLey\s+N\.?\s*[°º]?\s*(\d{4,5})\b/gi },
      { kind: 'decree', regex: /\bDecreto\s+(?:Legislativo|Supremo)\s+N\.?\s*[°º]?\s*([\d-]+(?:-[A-Z]{2,6})?)\b/gi },
      { kind: 'ruling', regex: /\b(?:STC|Exp(?:ediente)?\.?)\s*N?\.?\s*[°º]?\s*(\d{4,5}-\d{4}-[A-Z]{2}\/TC)\b/gi },
    ],
  }),
  legal: {
    privacyLaw: { name: 'Ley N.° 29733 de Protección de Datos Personales', url: 'https://www.gob.pe/institucion/minjus/normas-legales/1249876-29733' },
    dataAuthority: 'Autoridad Nacional de Protección de Datos Personales (MINJUSDH)',
    disclaimer: DISCLAIMER_ES,
  },
};
export default pe;
