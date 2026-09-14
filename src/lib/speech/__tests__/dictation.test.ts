import { describe, expect, it, vi } from 'vitest';
import { dictationSupported, languageTag, startDictation } from '../dictation';

type ResultEvent = { resultIndex: number; results: Array<{ isFinal: boolean; 0: { transcript: string } }> };

class FakeRecognition {
  lang = '';
  continuous = false;
  interimResults = false;
  onresult: ((e: ResultEvent) => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn();
}

describe('dictation', () => {
  it('detects support from either constructor name', () => {
    expect(dictationSupported({})).toBe(false);
    expect(dictationSupported({ webkitSpeechRecognition: FakeRecognition })).toBe(true);
    expect(dictationSupported({ SpeechRecognition: FakeRecognition })).toBe(true);
  });

  it('maps locales to BCP-47 tags with es-MX as default', () => {
    expect(languageTag('es')).toBe('es-MX');
    expect(languageTag('en')).toBe('en-US');
    expect(languageTag('pt')).toBe('es-MX');
  });

  it('returns null without support', () => {
    expect(startDictation('es', { onResult: vi.fn() }, {})).toBeNull();
  });

  it('accumulates final results and reports interim ones', () => {
    const instances: FakeRecognition[] = [];
    class Tracked extends FakeRecognition {
      constructor() {
        super();
        instances.push(this);
      }
    }
    const onResult = vi.fn();
    const onEnd = vi.fn();
    const handle = startDictation('es', { onResult, onEnd }, { SpeechRecognition: Tracked });
    expect(handle).not.toBeNull();
    const rec = instances[0]!;
    expect(rec.lang).toBe('es-MX');
    expect(rec.continuous).toBe(true);
    expect(rec.start).toHaveBeenCalled();
    rec.onresult?.({ resultIndex: 0, results: [{ isFinal: false, 0: { transcript: 'artículo' } }] });
    expect(onResult).toHaveBeenLastCalledWith('artículo', false);
    rec.onresult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: 'artículo 123 ' } }] });
    expect(onResult).toHaveBeenLastCalledWith('artículo 123', true);
    rec.onresult?.({
      resultIndex: 1,
      results: [{ isFinal: true, 0: { transcript: 'artículo 123 ' } }, { isFinal: false, 0: { transcript: 'constitucional' } }],
    });
    expect(onResult).toHaveBeenLastCalledWith('artículo 123 constitucional', false);
    handle?.stop();
    expect(rec.stop).toHaveBeenCalled();
    rec.onend?.();
    expect(onEnd).toHaveBeenCalled();
  });
});
