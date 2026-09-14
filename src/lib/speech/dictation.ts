/**
 * Voice dictation for the prompt (plan § 11.4 C, first step before a local
 * Whisper). Uses the browser's SpeechRecognition when available. Depending on
 * the browser this may send audio to the browser vendor, so the UI labels it
 * and it only runs after an explicit click. Nothing is stored.
 */

export interface DictationHandle {
  stop: () => void;
}

export interface DictationCallbacks {
  onResult: (text: string, isFinal: boolean) => void;
  onEnd?: () => void;
  onError?: (code: string) => void;
}

interface RecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface RecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<RecognitionResultLike>;
}
interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: RecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type RecognitionCtor = new () => RecognitionLike;

function recognitionCtor(win: unknown): RecognitionCtor | null {
  const w = win as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor } | undefined;
  return w?.SpeechRecognition ?? w?.webkitSpeechRecognition ?? null;
}

export function dictationSupported(win: unknown = typeof window === 'undefined' ? undefined : window): boolean {
  return recognitionCtor(win) !== null;
}

export function languageTag(locale: string): string {
  return locale.startsWith('en') ? 'en-US' : 'es-MX';
}

export function startDictation(
  locale: string,
  callbacks: DictationCallbacks,
  win: unknown = typeof window === 'undefined' ? undefined : window,
): DictationHandle | null {
  const Ctor = recognitionCtor(win);
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = languageTag(locale);
  rec.continuous = true;
  rec.interimResults = true;
  let finalText = '';
  rec.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (!r) continue;
      if (r.isFinal) finalText += r[0].transcript;
      else interim += r[0].transcript;
    }
    callbacks.onResult((finalText + interim).trim(), interim.length === 0);
  };
  rec.onerror = (e) => callbacks.onError?.(e.error);
  rec.onend = () => callbacks.onEnd?.();
  rec.start();
  return { stop: () => rec.stop() };
}
