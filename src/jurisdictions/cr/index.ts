/** Costa Rica (plan § 11.3): SCIJ (PGR) y Nexus PJ; acceso programático por verificar. */
import type { Jurisdiction } from '../types';
import { DISCLAIMER_ES, makeCitationStyle } from '../_shared/citation';

export const CR_ENTITIES = [
  ['CR-SJ', 'San José'], ['CR-A', 'Alajuela'], ['CR-C', 'Cartago'], ['CR-H', 'Heredia'],
  ['CR-G', 'Guanacaste'], ['CR-P', 'Puntarenas'], ['CR-L', 'Limón'],
] as const;

export const cr: Jurisdiction = {
  code: 'cr',
  name: 'Costa Rica',
  languages: ['es'],
  defaultLanguage: 'es',
  corpusScopes: ['cr-nacional', ...CR_ENTITIES.map(([c]) => c.toLowerCase())],
  hierarchy: [
    { level: 1, name: 'Constitución Política de 1949', examples: ['Constitución Política de la República de Costa Rica'] },
    { level: 2, name: 'Tratados internacionales', examples: ['Convención Americana sobre Derechos Humanos'] },
    { level: 3, name: 'Leyes y códigos', examples: ['Ley N.° 8968', 'Código de Trabajo'] },
    { level: 4, name: 'Decretos ejecutivos y reglamentos', examples: ['Decreto Ejecutivo N.° 37554-JP'] },
    { level: 5, name: 'Resoluciones y directrices', examples: ['Resolución de la PRODHAB'] },
    { level: 6, name: 'Reglamentos municipales', examples: ['Reglamento de la Municipalidad de San José'] },
  ],
  entities: CR_ENTITIES.map(([code, name]) => ({ code, name })),
  sources: [
    { id: 'scij', name: 'SCIJ · Sistema Costarricense de Información Jurídica (PGR)', kind: 'legislation', access: 'unverified', url: 'http://www.pgrweb.go.cr/scij/', notes: 'Normativa vigente y dictámenes; relevar acceso programático.' },
    { id: 'nexus-pj', name: 'Nexus PJ · Poder Judicial', kind: 'jurisprudence', access: 'unverified', url: 'https://nexuspj.poder-judicial.go.cr/' },
    { id: 'la-gaceta', name: 'La Gaceta (Imprenta Nacional)', kind: 'gazette', access: 'open-download', url: 'https://www.imprentanacional.go.cr/gaceta/' },
  ],
  citation: makeCitationStyle({
    language: 'es',
    constitution: 'Constitución Política',
    instrumentLead: String.raw`Ley|C[óo]digo|Decreto|Reglamento|Constituci[óo]n`,
    extra: [
      { kind: 'law', regex: /\bLey\s+N\.?\s*[°º]?\s*(\d{4,5})\b/gi },
      { kind: 'ruling', regex: /\b(?:Voto|Resoluci[óo]n)\s+N\.?\s*[°º]?\s*(\d{4}-\d{1,6})\b/gi },
    ],
  }),
  legal: {
    privacyLaw: { name: 'Ley N.° 8968 de Protección de la Persona frente al Tratamiento de sus Datos Personales', url: 'http://www.pgrweb.go.cr/scij/Busqueda/Normativa/Normas/nrm_texto_completo.aspx?nValor1=1&nValor2=70975' },
    dataAuthority: 'PRODHAB · Agencia de Protección de Datos de los Habitantes',
    disclaimer: DISCLAIMER_ES,
  },
};
export default cr;
