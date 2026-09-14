/**
 * Active jurisdiction shared across islands (plan § 11.2). Persisted in
 * localStorage `lexmx_jurisdiction`; defaults to Mexico. Islands read it
 * with useStore and pass it to retrieval as `corpusFilter.jurisdiction`.
 */
import { atom, onMount } from 'nanostores';
import { DEFAULT_JURISDICTION, getJurisdiction, isJurisdictionCode, type Jurisdiction, type JurisdictionCode } from '@/jurisdictions';

export const JURISDICTION_KEY = 'lexmx_jurisdiction';

export const $jurisdictionCode = atom<JurisdictionCode>(DEFAULT_JURISDICTION);

export function readStoredJurisdiction(): JurisdictionCode {
  try {
    const stored = typeof localStorage === 'undefined' ? null : localStorage.getItem(JURISDICTION_KEY);
    return stored && isJurisdictionCode(stored) ? stored : DEFAULT_JURISDICTION;
  } catch {
    return DEFAULT_JURISDICTION;
  }
}

export function setJurisdiction(code: string): void {
  if (!isJurisdictionCode(code)) return;
  $jurisdictionCode.set(code);
  try {
    localStorage.setItem(JURISDICTION_KEY, code);
  } catch {
    // storage unavailable: keep the in-memory value
  }
}

export function currentJurisdiction(): Jurisdiction {
  return getJurisdiction($jurisdictionCode.get());
}

onMount($jurisdictionCode, () => {
  $jurisdictionCode.set(readStoredJurisdiction());
});
