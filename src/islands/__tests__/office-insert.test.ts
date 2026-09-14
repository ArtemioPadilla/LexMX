import { describe, expect, it } from 'vitest';
import { answerToPlainText } from '../OfficeInsertBar';

describe('answerToPlainText', () => {
  it('strips markdown emphasis, headings, links and code fences for Word', () => {
    const md = '## Respuesta\n\nEl **artículo 47** de la [LFT](https://x) dice:\n\n- causa *uno*\n- causa dos\n\n```\ncódigo\n```';
    expect(answerToPlainText(md)).toBe('Respuesta\n\nEl artículo 47 de la LFT dice:\n\n• causa uno\n• causa dos\n\ncódigo');
  });

  it('leaves plain text untouched', () => {
    expect(answerToPlainText('Texto simple.')).toBe('Texto simple.');
  });
});
