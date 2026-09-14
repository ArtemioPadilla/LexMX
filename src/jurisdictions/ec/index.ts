/** Ecuador (plan § 11.3): Registro Oficial y datosabiertos.gob.ec; sin API confirmada. */
import type { Jurisdiction } from '../types';
import { DISCLAIMER_ES, makeCitationStyle } from '../_shared/citation';

export const EC_ENTITIES = [
  ['EC-A', 'Azuay'], ['EC-B', 'Bolívar'], ['EC-F', 'Cañar'], ['EC-C', 'Carchi'], ['EC-H', 'Chimborazo'], ['EC-X', 'Cotopaxi'],
  ['EC-O', 'El Oro'], ['EC-E', 'Esmeraldas'], ['EC-W', 'Galápagos'], ['EC-G', 'Guayas'], ['EC-I', 'Imbabura'], ['EC-L', 'Loja'],
  ['EC-R', 'Los Ríos'], ['EC-M', 'Manabí'], ['EC-S', 'Morona Santiago'], ['EC-N', 'Napo'], ['EC-D', 'Orellana'], ['EC-Y', 'Pastaza'],
  ['EC-P', 'Pichincha'], ['EC-SE', 'Santa Elena'], ['EC-SD', 'Santo Domingo de los Tsáchilas'], ['EC-U', 'Sucumbíos'],
  ['EC-T', 'Tungurahua'], ['EC-Z', 'Zamora Chinchipe'],
] as const;

export const ec: Jurisdiction = {
  code: 'ec',
  name: 'Ecuador',
  languages: ['es'],
  defaultLanguage: 'es',
  corpusScopes: ['ec-nacional', ...EC_ENTITIES.map(([c]) => c.toLowerCase())],
  hierarchy: [
    { level: 1, name: 'Constitución de la República de 2008', examples: ['Constitución de la República del Ecuador'] },
    { level: 2, name: 'Tratados internacionales de derechos humanos', examples: ['Convención Americana sobre Derechos Humanos'] },
    { level: 3, name: 'Leyes orgánicas', examples: ['Ley Orgánica de Protección de Datos Personales', 'COIP'] },
    { level: 4, name: 'Leyes ordinarias y códigos', examples: ['Código del Trabajo'] },
    { level: 5, name: 'Decretos ejecutivos y reglamentos', examples: ['Reglamento a la LOPDP'] },
    { level: 6, name: 'Ordenanzas de los GAD', examples: ['Ordenanza del Municipio de Quito'] },
  ],
  entities: EC_ENTITIES.map(([code, name]) => ({ code, name })),
  sources: [
    { id: 'registro-oficial', name: 'Registro Oficial', kind: 'gazette', access: 'unverified', url: 'https://www.registroficial.gob.ec/', notes: 'Sin API confirmada; relevamiento de una semana antes de comprometer el shard.' },
    { id: 'datos-abiertos', name: 'Portal de Datos Abiertos', kind: 'legislation', access: 'unverified', url: 'https://www.datosabiertos.gob.ec/' },
    { id: 'corte-constitucional', name: 'Corte Constitucional del Ecuador', kind: 'jurisprudence', access: 'unverified', url: 'https://www.corteconstitucional.gob.ec/' },
  ],
  citation: makeCitationStyle({
    language: 'es',
    constitution: 'Constitución de la República',
    instrumentLead: String.raw`Ley|C[óo]digo|Decreto|Reglamento|Constituci[óo]n|Ordenanza`,
    extra: [{ kind: 'ruling', regex: /\bSentencia\s+N?\.?\s*[°º]?\s*(\d{1,4}-\d{2}-[A-Z]{2}\/\d{2})\b/gi }],
  }),
  legal: {
    privacyLaw: { name: 'Ley Orgánica de Protección de Datos Personales (2021)', url: 'https://www.finanzas.gob.ec/wp-content/uploads/downloads/2021/05/Ley-Organica-de-Proteccion-de-Datos-Personales.pdf' },
    dataAuthority: 'Superintendencia de Protección de Datos Personales',
    disclaimer: DISCLAIMER_ES,
  },
};
export default ec;
