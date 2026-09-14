/** Uruguay (plan § 11.3): IMPO con bases completas en JSON de uso libre. */
import type { Jurisdiction } from '../types';
import { DISCLAIMER_ES, makeCitationStyle } from '../_shared/citation';

export const UY_ENTITIES = [
  ['UY-AR', 'Artigas'], ['UY-CA', 'Canelones'], ['UY-CL', 'Cerro Largo'], ['UY-CO', 'Colonia'], ['UY-DU', 'Durazno'],
  ['UY-FS', 'Flores'], ['UY-FD', 'Florida'], ['UY-LA', 'Lavalleja'], ['UY-MA', 'Maldonado'], ['UY-MO', 'Montevideo'],
  ['UY-PA', 'Paysandú'], ['UY-RN', 'Río Negro'], ['UY-RV', 'Rivera'], ['UY-RO', 'Rocha'], ['UY-SA', 'Salto'],
  ['UY-SJ', 'San José'], ['UY-SO', 'Soriano'], ['UY-TA', 'Tacuarembó'], ['UY-TT', 'Treinta y Tres'],
] as const;

export const uy: Jurisdiction = {
  code: 'uy',
  name: 'Uruguay',
  languages: ['es'],
  defaultLanguage: 'es',
  corpusScopes: ['uy-nacional', ...UY_ENTITIES.map(([c]) => c.toLowerCase())],
  hierarchy: [
    { level: 1, name: 'Constitución de la República', examples: ['Constitución de la República Oriental del Uruguay'] },
    { level: 2, name: 'Tratados internacionales', examples: ['Convención Americana sobre Derechos Humanos'] },
    { level: 3, name: 'Leyes y códigos', examples: ['Ley N° 18.331', 'Código Civil', 'Código General del Proceso'] },
    { level: 4, name: 'Decretos del Poder Ejecutivo', examples: ['Decreto N° 414/009'] },
    { level: 5, name: 'Resoluciones', examples: ['Resolución de la URCDP'] },
    { level: 6, name: 'Decretos departamentales', examples: ['Decreto de la Junta Departamental de Montevideo'] },
  ],
  entities: UY_ENTITIES.map(([code, name]) => ({ code, name })),
  sources: [
    { id: 'impo', name: 'IMPO · Centro de Información Oficial', kind: 'legislation', access: 'open-api', url: 'https://www.impo.com.uy/', verifyUrl: 'https://www.impo.com.uy/bases/leyes/{id}', notes: 'Bases completas en JSON de uso libre desde 2018; también publica el Diario Oficial.' },
    { id: 'bjn', name: 'Poder Judicial · Base de Jurisprudencia Nacional', kind: 'jurisprudence', access: 'unverified', url: 'https://bjn.poderjudicial.gub.uy/', notes: 'Acceso programático por verificar.' },
    { id: 'diario-oficial', name: 'Diario Oficial (IMPO)', kind: 'gazette', access: 'open-download', url: 'https://www.impo.com.uy/diariooficial/' },
  ],
  citation: makeCitationStyle({
    language: 'es',
    constitution: 'Constitución de la República',
    instrumentLead: String.raw`Ley|C[óo]digo|Decreto|Resoluci[óo]n|Constituci[óo]n`,
    extra: [{ kind: 'law', regex: /\bLey\s+N[°º]?\s*([\d.]{4,7})\b/gi }],
  }),
  legal: {
    privacyLaw: { name: 'Ley N° 18.331 de Protección de Datos Personales', url: 'https://www.impo.com.uy/bases/leyes/18331-2008' },
    dataAuthority: 'URCDP · Unidad Reguladora y de Control de Datos Personales',
    disclaimer: DISCLAIMER_ES,
  },
};
export default uy;
