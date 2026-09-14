/** Panamá (plan § 11.3): Gaceta Oficial y ANTAI datos abiertos; acceso programático por verificar. */
import type { Jurisdiction } from '../types';
import { DISCLAIMER_ES, makeCitationStyle } from '../_shared/citation';

export const PA_ENTITIES = [
  ['PA-1', 'Bocas del Toro'], ['PA-2', 'Coclé'], ['PA-3', 'Colón'], ['PA-4', 'Chiriquí'], ['PA-5', 'Darién'],
  ['PA-6', 'Herrera'], ['PA-7', 'Los Santos'], ['PA-8', 'Panamá'], ['PA-9', 'Veraguas'], ['PA-10', 'Panamá Oeste'],
  ['PA-EM', 'Emberá-Wounaan'], ['PA-KY', 'Guna Yala'], ['PA-NB', 'Ngäbe-Buglé'], ['PA-NT', 'Naso Tjër Di'],
] as const;

export const pa: Jurisdiction = {
  code: 'pa',
  name: 'Panamá',
  languages: ['es'],
  defaultLanguage: 'es',
  corpusScopes: ['pa-nacional', ...PA_ENTITIES.map(([c]) => c.toLowerCase())],
  hierarchy: [
    { level: 1, name: 'Constitución Política de 1972', examples: ['Constitución Política de la República de Panamá'] },
    { level: 2, name: 'Tratados internacionales', examples: ['Convención Americana sobre Derechos Humanos'] },
    { level: 3, name: 'Leyes y códigos', examples: ['Ley 81 de 2019', 'Código de Trabajo'] },
    { level: 4, name: 'Decretos ejecutivos', examples: ['Decreto Ejecutivo 285 de 2021'] },
    { level: 5, name: 'Resoluciones', examples: ['Resolución de la ANTAI'] },
    { level: 6, name: 'Acuerdos municipales', examples: ['Acuerdo del Consejo Municipal de Panamá'] },
  ],
  entities: PA_ENTITIES.map(([code, name]) => ({ code, name })),
  sources: [
    { id: 'gaceta-oficial', name: 'Gaceta Oficial Digital', kind: 'gazette', access: 'unverified', url: 'https://www.gacetaoficial.gob.pa/', notes: 'Texto oficial de leyes y decretos; relevar acceso programático.' },
    { id: 'antai', name: 'ANTAI · Datos abiertos', kind: 'other', access: 'unverified', url: 'https://www.antai.gob.pa/' },
    { id: 'organo-judicial', name: 'Órgano Judicial · Jurisprudencia', kind: 'jurisprudence', access: 'unverified', url: 'https://www.organojudicial.gob.pa/' },
  ],
  citation: makeCitationStyle({
    language: 'es',
    constitution: 'Constitución Política',
    instrumentLead: String.raw`Ley|C[óo]digo|Decreto|Resoluci[óo]n|Constituci[óo]n|Acuerdo`,
    extra: [{ kind: 'law', regex: /\bLey\s+(\d{1,4}\s+de\s+(?:\d{1,2}\s+de\s+[a-z]+\s+de\s+)?\d{4})\b/gi }],
  }),
  legal: {
    privacyLaw: { name: 'Ley 81 de 2019 sobre Protección de Datos Personales', url: 'https://www.gacetaoficial.gob.pa/pdfTemp/28743_A/GacetaNo_28743a_20190329.pdf' },
    dataAuthority: 'ANTAI · Autoridad Nacional de Transparencia y Acceso a la Información',
    disclaimer: DISCLAIMER_ES,
  },
};
export default pa;
