import { describe, it, expect } from 'vitest';
import { getTranslation, getTranslationForLang, getTranslations, hasTranslation } from '../utils';

describe('getTranslation (Astro URL-based)', () => {
  it('defaults to Spanish for a URL without an /en segment', () => {
    const t = getTranslation(new URL('https://lexmx.example/chat'));
    expect(t('rag.title')).toBe('Procesamiento RAG');
  });

  it('picks English when the URL path includes /en', () => {
    const t = getTranslation(new URL('https://lexmx.example/en/chat'));
    // English copy differs from the Spanish string above.
    expect(t('rag.title')).not.toBe('Procesamiento RAG');
    expect(typeof t('rag.title')).toBe('string');
    expect(t('rag.title').length).toBeGreaterThan(0);
  });

  it('also accepts a plain path string', () => {
    const t = getTranslation('/en/chat');
    expect(t('rag.title')).toBe(getTranslation(new URL('https://lexmx.example/en/chat'))('rag.title'));
  });

  it('interpolates params', () => {
    const t = getTranslation(new URL('https://lexmx.example/'));
    expect(t('rag.details.documentsFound', { count: 3 })).toBe('3 documentos encontrados');
  });

  it('falls back to the raw key when missing from both languages', () => {
    const t = getTranslation(new URL('https://lexmx.example/'));
    expect(t('no.such.key.here')).toBe('no.such.key.here');
  });

  it('defaults to Spanish when given no URL', () => {
    // @ts-expect-error -- exercising the defensive "no URL" branch
    const t = getTranslation(undefined);
    expect(t('rag.title')).toBe('Procesamiento RAG');
  });
});

describe('getTranslationForLang / getTranslations / hasTranslation', () => {
  it('returns a translator fixed to the given language', () => {
    const es = getTranslationForLang('es');
    const en = getTranslationForLang('en');
    expect(es('rag.title')).toBe('Procesamiento RAG');
    expect(en('rag.title')).not.toBe(es('rag.title'));
  });

  it('exposes the full translation tree for a language', () => {
    const es = getTranslations('es');
    expect(es).toHaveProperty('rag');
  });

  it('reports whether a key exists', () => {
    expect(hasTranslation('rag.title', 'es')).toBe(true);
    expect(hasTranslation('not.a.real.key', 'es')).toBe(false);
  });
});
