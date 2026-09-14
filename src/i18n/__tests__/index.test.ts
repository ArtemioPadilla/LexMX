import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { i18n } from '../index';
import type { Language } from '../index';

/**
 * The global test setup (src/test/setupTests.ts) stubs window.localStorage
 * with vi.fn() mocks that always return null, which can't round-trip data.
 * Replace it with a real in-memory Map-backed implementation for this file.
 * We do NOT `vi.mock` the module under test — `i18n` is a real singleton.
 */
function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}

beforeEach(() => {
  Object.defineProperty(window, 'localStorage', {
    value: createMemoryStorage(),
    writable: true,
    configurable: true,
  });
  // Start every test from a known language, independent of jsdom's
  // navigator.language (used only by the constructor, at import time).
  i18n.setLanguage('es');
});

describe('i18n.t()', () => {
  it('looks up a nested key and interpolates params', () => {
    const result = i18n.t('rag.details.documentsFound', { count: 5 });
    expect(result).toBe('5 documentos encontrados');
  });

  it('falls back to Spanish when the requested language has no translations loaded', () => {
    // 'xx' isn't a key of `translations`, so the primary lookup fails and
    // the fallback-to-`es` branch in `t()` is exercised.
    const result = i18n.t('rag.title', undefined, 'xx' as Language);
    expect(result).toBe(i18n.t('rag.title', undefined, 'es'));
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns the raw key when it exists in neither the requested language nor the Spanish fallback', () => {
    const result = i18n.t('this.key.definitely.does.not.exist');
    expect(result).toBe('this.key.definitely.does.not.exist');
  });
});

describe('i18n language changes', () => {
  afterEach(() => {
    i18n.setLanguage('es');
  });

  it('notifies subscribed listeners when the language changes', () => {
    const seen: Language[] = [];
    const unsubscribe = i18n.onChange((lang) => seen.push(lang));

    i18n.setLanguage('en');

    expect(seen).toEqual(['en']);
    expect(i18n.language).toBe('en');

    unsubscribe();
  });

  it('does not notify listeners once unsubscribed', () => {
    const seen: Language[] = [];
    const unsubscribe = i18n.onChange((lang) => seen.push(lang));
    unsubscribe();

    i18n.setLanguage('en');

    expect(seen).toEqual([]);
  });

  it('does not re-notify when setting the same language again', () => {
    const seen: Language[] = [];
    i18n.setLanguage('en');
    const unsubscribe = i18n.onChange((lang) => seen.push(lang));

    i18n.setLanguage('en'); // no-op: already 'en'

    expect(seen).toEqual([]);
    unsubscribe();
  });

  it('persists the selected language under the "language" localStorage key', () => {
    i18n.setLanguage('en');
    expect(localStorage.getItem('language')).toBe('en');

    i18n.setLanguage('es');
    expect(localStorage.getItem('language')).toBe('es');
  });
});
