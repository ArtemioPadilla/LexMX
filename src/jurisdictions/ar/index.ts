/** Argentina (plan § 11.3): InfoLEG y SAIJ; dataset CC-BY 4.0 en datos.jus.gob.ar. */
import type { Jurisdiction } from '../types';
import { DISCLAIMER_ES, makeCitationStyle } from '../_shared/citation';

export const AR_ENTITIES = [
  ['AR-C', 'Ciudad Autónoma de Buenos Aires'], ['AR-B', 'Buenos Aires'], ['AR-K', 'Catamarca'], ['AR-H', 'Chaco'],
  ['AR-U', 'Chubut'], ['AR-X', 'Córdoba'], ['AR-W', 'Corrientes'], ['AR-E', 'Entre Ríos'], ['AR-P', 'Formosa'],
  ['AR-Y', 'Jujuy'], ['AR-L', 'La Pampa'], ['AR-F', 'La Rioja'], ['AR-M', 'Mendoza'], ['AR-N', 'Misiones'],
  ['AR-Q', 'Neuquén'], ['AR-R', 'Río Negro'], ['AR-A', 'Salta'], ['AR-J', 'San Juan'], ['AR-D', 'San Luis'],
  ['AR-Z', 'Santa Cruz'], ['AR-S', 'Santa Fe'], ['AR-G', 'Santiago del Estero'],
  ['AR-V', 'Tierra del Fuego, Antártida e Islas del Atlántico Sur'], ['AR-T', 'Tucumán'],
] as const;

export const ar: Jurisdiction = {
  code: 'ar',
  name: 'Argentina',
  languages: ['es'],
  defaultLanguage: 'es',
  corpusScopes: ['ar-nacional', ...AR_ENTITIES.map(([c]) => c.toLowerCase())],
  hierarchy: [
    { level: 1, name: 'Constitución Nacional', examples: ['Constitución de la Nación Argentina'] },
    { level: 2, name: 'Tratados con jerarquía constitucional (art. 75 inc. 22)', examples: ['Pacto de San José de Costa Rica'] },
    { level: 3, name: 'Leyes nacionales y códigos', examples: ['Ley 20.744 de Contrato de Trabajo', 'Código Civil y Comercial'] },
    { level: 4, name: 'Decretos del Poder Ejecutivo', examples: ['Decreto 70/2023'] },
    { level: 5, name: 'Resoluciones y disposiciones', examples: ['Resolución General AFIP'] },
    { level: 6, name: 'Constituciones y leyes provinciales', examples: ['Constitución de la Provincia de Buenos Aires'] },
    { level: 7, name: 'Ordenanzas municipales', examples: ['Ordenanza municipal de Rosario'] },
  ],
  entities: AR_ENTITIES.map(([code, name]) => ({ code, name })),
  sources: [
    { id: 'infoleg', name: 'InfoLEG · Información Legislativa y Documental', kind: 'legislation', access: 'open-download', url: 'https://www.infoleg.gob.ar/', verifyUrl: 'https://servicios.infoleg.gob.ar/infolegInternet/verNorma.do?id={id}', notes: 'Texto actualizado de normas nacionales con historial de modificaciones.' },
    { id: 'saij', name: 'SAIJ · Sistema Argentino de Información Jurídica', kind: 'jurisprudence', access: 'open-download', url: 'https://www.saij.gob.ar/', notes: 'Legislación, fallos de la CSJN y tribunales; dataset en datos.jus.gob.ar bajo CC-BY 4.0.' },
    { id: 'datos-jus', name: 'datos.jus.gob.ar (CC-BY 4.0)', kind: 'legislation', access: 'open-download', url: 'https://datos.jus.gob.ar/', notes: 'La licencia más clara de la región; base del shard ar-nacional.' },
    { id: 'boletin-oficial', name: 'Boletín Oficial de la República Argentina', kind: 'gazette', access: 'open-download', url: 'https://www.boletinoficial.gob.ar/' },
  ],
  citation: makeCitationStyle({
    language: 'es',
    constitution: 'Constitución Nacional',
    instrumentLead: String.raw`Ley|C[óo]digo|Decreto|Resoluci[óo]n|Constituci[óo]n`,
    extra: [
      { kind: 'law', regex: /\bLey\s+(?:N[°º]?\s*)?([\d.]{4,7})\b/gi },
      { kind: 'ruling', regex: /\bFallos:?\s*(\d{2,3}:\d{1,4})\b/gi },
    ],
  }),
  legal: {
    privacyLaw: { name: 'Ley 25.326 de Protección de los Datos Personales', url: 'https://servicios.infoleg.gob.ar/infolegInternet/anexos/60000-64999/64790/texact.htm' },
    dataAuthority: 'Agencia de Acceso a la Información Pública',
    disclaimer: DISCLAIMER_ES,
  },
};
export default ar;
