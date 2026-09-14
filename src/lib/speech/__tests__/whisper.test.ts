import { describe, expect, it } from 'vitest';
import { formatTimestamp, transcriptToText, whisperLanguage, type Transcript } from '../whisper';
import { pickMimeType, recordingSupported } from '../recorder';

describe('whisper helpers', () => {
  it('maps locales to Whisper languages with Spanish as default', () => {
    expect(whisperLanguage('es')).toBe('es');
    expect(whisperLanguage('en-US')).toBe('en');
    expect(whisperLanguage('pt-BR')).toBe('pt');
    expect(whisperLanguage('fr')).toBe('es');
  });

  it('formats timestamps as mm:ss', () => {
    expect(formatTimestamp(0)).toBe('00:00');
    expect(formatTimestamp(65.9)).toBe('01:05');
    expect(formatTimestamp(-3)).toBe('00:00');
  });

  it('renders one timestamped line per segment and falls back to plain text', () => {
    const t: Transcript = {
      text: 'hola mundo',
      segments: [{ text: 'hola', start: 0, end: 1 }, { text: 'mundo', start: 61, end: 62 }],
      language: 'es',
      model: 'Xenova/whisper-tiny',
      durationSeconds: 62,
    };
    expect(transcriptToText(t)).toBe('[00:00] hola\n[01:01] mundo');
    expect(transcriptToText({ ...t, segments: [] })).toBe('hola mundo');
  });
});

describe('recorder helpers', () => {
  it('picks the first supported MIME type in preference order', () => {
    expect(pickMimeType((t) => t === 'audio/mp4')).toBe('audio/mp4');
    expect(pickMimeType(() => true)).toBe('audio/webm;codecs=opus');
    expect(pickMimeType(() => false)).toBe('');
  });

  it('reports recording support only with MediaRecorder and getUserMedia', () => {
    expect(recordingSupported({})).toBe(false);
    expect(recordingSupported({ mediaDevices: {} })).toBe(false);
  });
});
