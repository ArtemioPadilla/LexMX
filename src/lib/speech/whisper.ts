/**
 * Local speech-to-text with Whisper via transformers.js (plan § 11.4 C:
 * "notas de voz y transcripción local"). The model (~40 MB for tiny) is
 * downloaded once from the Hugging Face CDN and cached by the browser; the
 * audio is decoded and transcribed on the device and never uploaded.
 *
 * `@xenova/transformers` is imported dynamically (CLAUDE.md warning 3).
 */

export type WhisperLanguage = 'es' | 'en' | 'pt';
export type WhisperModel = 'Xenova/whisper-tiny' | 'Xenova/whisper-base' | 'Xenova/whisper-small';

export interface TranscribeOptions {
  language?: WhisperLanguage;
  model?: WhisperModel;
  onProgress?: (p: { status: string; progress: number; file?: string }) => void;
}

export interface TranscriptSegment {
  text: string;
  start: number;
  end: number;
}

export interface Transcript {
  text: string;
  segments: TranscriptSegment[];
  language: WhisperLanguage;
  model: WhisperModel;
  durationSeconds: number;
}

export const WHISPER_SAMPLE_RATE = 16_000;
export const DEFAULT_WHISPER_MODEL: WhisperModel = 'Xenova/whisper-tiny';

/** Whisper wants the language name; the UI works with locale codes. */
export function whisperLanguage(locale: string): WhisperLanguage {
  if (locale.startsWith('en')) return 'en';
  if (locale.startsWith('pt')) return 'pt';
  return 'es';
}

const LANGUAGE_NAMES: Record<WhisperLanguage, string> = { es: 'spanish', en: 'english', pt: 'portuguese' };

/** Mono Float32 PCM at 16 kHz from any decodable audio blob (browser only). */
export async function decodeToPcm(blob: Blob): Promise<{ pcm: Float32Array; durationSeconds: number }> {
  const bytes = await blob.arrayBuffer();
  const Ctx = (globalThis as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
    ?? (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) throw new Error('Web Audio API not available');
  const ctx = new Ctx({ sampleRate: WHISPER_SAMPLE_RATE });
  try {
    const decoded = await ctx.decodeAudioData(bytes);
    const length = Math.ceil(decoded.duration * WHISPER_SAMPLE_RATE);
    const offline = new OfflineAudioContext(1, length, WHISPER_SAMPLE_RATE);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();
    const rendered = await offline.startRendering();
    return { pcm: rendered.getChannelData(0), durationSeconds: decoded.duration };
  } finally {
    await ctx.close();
  }
}

type AsrPipeline = (
  audio: Float32Array,
  options: Record<string, unknown>,
) => Promise<{ text: string; chunks?: Array<{ text: string; timestamp: [number, number | null] }> }>;

const pipelines = new Map<WhisperModel, Promise<AsrPipeline>>();

async function loadPipeline(model: WhisperModel, onProgress?: TranscribeOptions['onProgress']): Promise<AsrPipeline> {
  let p = pipelines.get(model);
  if (!p) {
    p = (async () => {
      const { pipeline, env } = await import('@xenova/transformers');
      env.allowLocalModels = false;
      const asr = await pipeline('automatic-speech-recognition', model, {
        progress_callback: (e: { status?: string; progress?: number; file?: string }) =>
          onProgress?.({ status: e.status ?? 'loading', progress: (e.progress ?? 0) / 100, file: e.file }),
      });
      return asr as unknown as AsrPipeline;
    })();
    pipelines.set(model, p);
    p.catch(() => pipelines.delete(model));
  }
  return p;
}

/** Transcribes an audio blob (recording or file) on the device. */
export async function transcribeAudio(blob: Blob, options: TranscribeOptions = {}): Promise<Transcript> {
  const language = options.language ?? 'es';
  const model = options.model ?? DEFAULT_WHISPER_MODEL;
  const { pcm, durationSeconds } = await decodeToPcm(blob);
  const asr = await loadPipeline(model, options.onProgress);
  options.onProgress?.({ status: 'transcribing', progress: 0 });
  const out = await asr(pcm, {
    language: LANGUAGE_NAMES[language],
    task: 'transcribe',
    chunk_length_s: 30,
    stride_length_s: 5,
    return_timestamps: true,
  });
  options.onProgress?.({ status: 'done', progress: 1 });
  return {
    text: out.text.trim(),
    segments: (out.chunks ?? []).map((c) => ({ text: c.text.trim(), start: c.timestamp[0], end: c.timestamp[1] ?? durationSeconds })),
    language,
    model,
    durationSeconds,
  };
}

/** "mm:ss" for segment timestamps. */
export function formatTimestamp(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** Transcript as text with one timestamped line per segment (for notes and expedientes). */
export function transcriptToText(t: Transcript): string {
  if (t.segments.length === 0) return t.text;
  return t.segments.map((s) => `[${formatTimestamp(s.start)}] ${s.text}`).join('\n');
}
