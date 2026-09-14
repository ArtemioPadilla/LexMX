import { beforeEach, describe, expect, it } from 'vitest';
import { $jurisdictionCode, JURISDICTION_KEY, currentJurisdiction, readStoredJurisdiction, setJurisdiction } from '../jurisdiction';

describe('jurisdiction store', () => {
  beforeEach(() => {
    const mem = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k), clear: () => mem.clear(), key: () => null, length: 0 } });
    $jurisdictionCode.set('mx');
  });

  it('defaults to Mexico and ignores unknown codes', () => {
    expect(readStoredJurisdiction()).toBe('mx');
    setJurisdiction('zz');
    expect($jurisdictionCode.get()).toBe('mx');
  });

  it('persists a valid code and resolves the module', () => {
    setJurisdiction('cl');
    expect(localStorage.getItem(JURISDICTION_KEY)).toBe('cl');
    expect(readStoredJurisdiction()).toBe('cl');
    expect(currentJurisdiction().name).toBe('Chile');
  });
});
