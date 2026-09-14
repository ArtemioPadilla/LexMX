/**
 * Microphone recording for local transcription (plan § 11.4 C). Wraps
 * MediaRecorder; the audio stays in memory as a Blob and is handed to
 * `transcribeAudio`. Nothing is uploaded.
 */

export interface Recording {
  /** Stops the recorder and releases the microphone. */
  stop: () => Promise<Blob>;
  mimeType: string;
}

export function recordingSupported(nav: unknown = typeof navigator === 'undefined' ? undefined : navigator): boolean {
  const n = nav as { mediaDevices?: { getUserMedia?: unknown } } | undefined;
  return typeof MediaRecorder !== 'undefined' && typeof n?.mediaDevices?.getUserMedia === 'function';
}

/** First MIME type the browser can record; Chrome/Firefox → webm/opus, Safari → mp4. */
export function pickMimeType(isSupported: (t: string) => boolean = (t) => MediaRecorder.isTypeSupported(t)): string {
  for (const t of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']) {
    if (isSupported(t)) return t;
  }
  return '';
}

export async function startRecording(): Promise<Recording> {
  if (!recordingSupported()) throw new Error('recording not supported');
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mimeType = pickMimeType();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
  recorder.start(1000);
  return {
    mimeType: recorder.mimeType,
    stop: () =>
      new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          resolve(new Blob(chunks, { type: recorder.mimeType }));
        };
        recorder.stop();
      }),
  };
}
