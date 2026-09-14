/** Chile (plan § 11.3): Ley Chile (BCN) en XML público; jurisprudencia enlazada; dictámenes de Contraloría. */
import type { Jurisdiction } from '../types';
import { DISCLAIMER_ES, makeCitationStyle } from '../_shared/citation';

export const CL_ENTITIES = [
  ['CL-AP', 'Arica y Parinacota'], ['CL-TA', 'Tarapacá'], ['CL-AN', 'Antofagasta'], ['CL-AT', 'Atacama'],
  ['CL-CO', 'Coquimbo'], ['CL-VS', 'Valparaíso'], ['CL-RM', 'Región Metropolitana de Santiago'],
  ['CL-LI', "Libertador General Bernardo O'Higgins"], ['CL-ML', 'Maule'], ['CL-NB', 'Ñuble'], ['CL-BI', 'Biobío'],
  ['CL-AR', 'La Araucanía'], ['CL-LR', 'Los Ríos'], ['CL-LL', 'Los Lagos'],
  ['CL-AI', 'Aysén del General Carlos Ibáñez del Campo'], ['CL-MA', 'Magallanes y de la Antártica Chilena'],
] as const;

export const cl: Jurisdiction = {
  code: 'cl',
  name: 'Chile',
  languages: ['es'],
  defaultLanguage: 'es',
  corpusScopes: ['cl-nacional', ...CL_ENTITIES.map(([c]) => c.toLowerCase())],
  hierarchy: [
    { level: 1, name: 'Constitución Política de la República', examples: ['Constitución Política de la República de Chile'] },
    { level: 2, name: 'Tratados internacionales', examples: ['Convención Americana sobre Derechos Humanos'] },
    { level: 3, name: 'Leyes, DFL y DL', examples: ['Código del Trabajo', 'Ley N° 19.628', 'Código Civil'] },
    { level: 4, name: 'Reglamentos y decretos supremos', examples: ['Decreto Supremo N° 594'] },
    { level: 5, name: 'Resoluciones y dictámenes', examples: ['Dictamen de la Contraloría General de la República'] },
    { level: 6, name: 'Ordenanzas municipales', examples: ['Ordenanza municipal de Santiago'] },
  ],
  entities: CL_ENTITIES.map(([code, name]) => ({ code, name })),
  sources: [
    { id: 'bcn-leychile', name: 'Ley Chile · Biblioteca del Congreso Nacional', kind: 'legislation', access: 'open-api', url: 'https://www.bcn.cl/leychile/', verifyUrl: 'https://www.bcn.cl/leychile/navegar?idNorma={id}', notes: 'XML público sin registro (obtxml) y datos enlazados; todos los códigos con texto vigente.' },
    { id: 'pjud-juris', name: 'Poder Judicial · Jurisprudencia', kind: 'jurisprudence', access: 'open-download', url: 'https://juris.pjud.cl/', notes: 'Sentencias de la Corte Suprema enlazadas a normas en Ley Chile.' },
    { id: 'cgr-dictamenes', name: 'Contraloría General · Dictámenes', kind: 'jurisprudence', access: 'open-api', url: 'https://www.contraloria.cl/web/cgr/dictamenes-y-pronunciamientos-juridicos', notes: 'API REST de dictámenes.' },
    { id: 'diario-oficial', name: 'Diario Oficial de la República de Chile', kind: 'gazette', access: 'open-download', url: 'https://www.diariooficial.interior.gob.cl/' },
  ],
  citation: makeCitationStyle({
    language: 'es',
    constitution: 'Constitución Política de la República',
    instrumentLead: String.raw`Ley|C[óo]digo|Decreto|DFL|DL|Reglamento|Constituci[óo]n|Ordenanza`,
    extra: [
      { kind: 'law', regex: /\bLey\s+N[°º]?\s*([\d.]{4,7})\b/gi },
      { kind: 'ruling', regex: /\bRol\s+N?[°º]?\s*([\d.]+-\d{4})\b/gi },
    ],
  }),
  legal: {
    privacyLaw: { name: 'Ley N° 19.628 sobre Protección de la Vida Privada (y Ley N° 21.719)', url: 'https://www.bcn.cl/leychile/navegar?idNorma=141599' },
    dataAuthority: 'Agencia de Protección de Datos Personales',
    disclaimer: DISCLAIMER_ES,
  },
};
export default cl;
