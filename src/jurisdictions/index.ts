/**
 * Registro de jurisdicciones (plan § 11.2). Cada país es un módulo
 * `./<cc>/index.ts` que implementa `Jurisdiction` y una línea aquí. México es
 * la referencia; los demás siguen el mapa de fuentes de § 11.3 y quedan
 * marcados `unverified` donde el acceso programático no se ha confirmado.
 */
import type { Jurisdiction, JurisdictionCode } from './types';
import { mx } from './mx';
import { cl } from './cl';
import { ar } from './ar';
import { co } from './co';
import { pe } from './pe';
import { br } from './br';
import { uy } from './uy';
import { ec } from './ec';
import { cr } from './cr';
import { pa } from './pa';

export type { Jurisdiction, JurisdictionCode, HierarchyLevel, LegalSource, SubnationalEntity, ParsedCitation, CitationStyle, LegalFramework, Language } from './types';

/** Orden = oleadas de § 11.4 B: MX → CL, AR, CO, PE → BR → UY, EC, CR, PA. */
const REGISTRY: Record<JurisdictionCode, Jurisdiction> = { mx, cl, ar, co, pe, br, uy, ec, cr, pa };

export const DEFAULT_JURISDICTION: JurisdictionCode = 'mx';

export function isJurisdictionCode(code: string): code is JurisdictionCode {
  return Object.prototype.hasOwnProperty.call(REGISTRY, code);
}

export function getJurisdiction(code: string = DEFAULT_JURISDICTION): Jurisdiction {
  if (!isJurisdictionCode(code)) {
    throw new Error(`Jurisdicción no soportada: ${code}. Disponibles: ${Object.keys(REGISTRY).join(', ')}`);
  }
  return REGISTRY[code];
}

export function listJurisdictions(): Jurisdiction[] {
  return Object.values(REGISTRY);
}

/** `mx-federal` → { jurisdiction: 'mx', scope: 'federal' }; `cl` → ámbito nacional de Chile. */
export function parseCorpusScope(scope: string): { jurisdiction: JurisdictionCode; scope: string } {
  const [head, ...rest] = scope.toLowerCase().split('-');
  const jurisdiction = head && isJurisdictionCode(head) ? head : DEFAULT_JURISDICTION;
  const national = REGISTRY[jurisdiction].corpusScopes[0]!.slice(jurisdiction.length + 1);
  return { jurisdiction, scope: rest.join('-') || national };
}
