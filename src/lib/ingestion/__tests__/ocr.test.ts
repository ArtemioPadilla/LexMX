import { describe, expect, it } from 'vitest';
import { cleanOcrText, needsOcr } from '../ocr';

describe('ocr helpers', () => {
  it('needsOcr flags pages with an empty or negligible text layer', () => {
    expect(needsOcr('')).toBe(true);
    expect(needsOcr('   \n  1  \n')).toBe(true);
    expect(needsOcr('Artículo 123. Toda persona tiene derecho al trabajo digno')).toBe(false);
  });

  it('cleanOcrText joins hyphenated line breaks and collapses noise', () => {
    expect(cleanOcrText('indemni-\nzación constitucional   con  tres\n\n\n\nmeses  ')).toBe('indemnización constitucional con tres\n\nmeses');
    expect(cleanOcrText('Artículo 47.-\nSon causas')).toBe('Artículo 47.-\nSon causas');
  });
});
