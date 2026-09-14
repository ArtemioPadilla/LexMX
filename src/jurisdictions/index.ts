/**
 * Registro de jurisdicciones. Hoy solo México; cada país nuevo es un módulo
 * `./<cc>/index.ts` que implementa `Jurisdiction` y una línea aquí.
 */
import type { Jurisdiction, JurisdictionCode } from './types';
import { mx } from './mx';

export type { Jurisdiction, JurisdictionCode, HierarchyLevel, LegalSource, SubnationalEntity, ParsedCitation, CitationStyle, LegalFramework, Language } from './types';

const REGISTRY: Partial<Record<JurisdictionCode, Jurisdiction>> = { mx };

export const DEFAULT_JURISDICTION: JurisdictionCode = 'mx';

export function getJurisdiction(code: string = DEFAULT_JURISDICTION): Jurisdiction {
  const found = REGISTRY[code as JurisdictionCode];
  if (!found) {
    throw new Error(`Jurisdicción no soportada: ${code}. Disponibles: ${Object.keys(REGISTRY).join(', ')}`);
  }
  return found;
}

export function listJurisdictions(): Jurisdiction[] {
  return Object.values(REGISTRY).filter((j): j is Jurisdiction => Boolean(j));
}

/** `mx-federal` → { jurisdiction: 'mx', scope: 'federal' }; `mx-jal` → entidad Jalisco. */
export function parseCorpusScope(scope: string): { jurisdiction: JurisdictionCode; scope: string } {
  const [code, ...rest] = scope.split('-');
  return { jurisdiction: (code ?? DEFAULT_JURISDICTION) as JurisdictionCode, scope: rest.join('-') || 'federal' };
}
