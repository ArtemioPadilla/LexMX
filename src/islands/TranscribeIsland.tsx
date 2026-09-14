/**
 * Voice notes and local transcription (plan § 11.4 C): record from the
 * microphone or drop an audio file and get a timestamped transcript with
 * Whisper running in the browser. Audio never leaves the device.
 */
import { useEffect, useRef, useState } from 'react';
import { CopyIcon, DownloadIcon, MicIcon, SquareIcon, AudioLinesIcon } from 'lucide-react';
import { useTranslation } from '@/i18n';
import { recordingSupported, startRecording, type Recording } from '@/lib/speech/recorder';
import { transcriptToText, whisperLanguage, type Transcript, type WhisperLanguage, type WhisperModel } from '@/lib/speech/whisper';
import { downloadBlob } from '@/lib/export/docx';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Textarea } from '@/components/ui/textarea';
import { ProgressBar } from '@/components/ui/progress-bar';
import ErrorBoundary from './ErrorBoundary';

export default function TranscribeIsland() {
  return (
    <ErrorBoundary name="Transcribe">
      <Inner />
    </ErrorBoundary>
  );
}

const MODELS: Array<{ id: WhisperModel; label: string }> = [
  { id: 'Xenova/whisper-tiny', label: 'tiny · ~40 MB · rápido' },
  { id: 'Xenova/whisper-base', label: 'base · ~75 MB · mejor en español' },
  { id: 'Xenova/whisper-small', label: 'small · ~240 MB · más preciso' },
];

function Inner() {
  const { t, language } = useTranslation();
  const [lang, setLang] = useState<WhisperLanguage>(() => whisperLanguage(language));
  const [model, setModel] = useState<WhisperModel>('Xenova/whisper-tiny');
  const [canRecord, setCanRecord] = useState(false);
  const [recording, setRecording] = useState<Recording | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [progress, setProgress] = useState<{ status: string; progress: number } | null>(null);
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    setCanRecord(recordingSupported());
    return () => { if (timer.current) window.clearInterval(timer.current); };
  }, []);

  async function transcribe(blob: Blob) {
    setError(null);
    setTranscript(null);
    setProgress({ status: 'loading', progress: 0 });
    try {
      const { transcribeAudio } = await import('@/lib/speech/whisper');
      const result = await transcribeAudio(blob, { language: lang, model, onProgress: (p) => setProgress({ status: p.status, progress: p.progress }) });
      setTranscript(result);
      setText(transcriptToText(result));
    } catch (e) {
      setError(t('transcribe.error', { error: e instanceof Error ? e.message : String(e) }));
    } finally {
      setProgress(null);
    }
  }

  async function toggleRecording() {
    if (recording) {
      if (timer.current) window.clearInterval(timer.current);
      const blob = await recording.stop();
      setRecording(null);
      await transcribe(blob);
      return;
    }
    try {
      const rec = await startRecording();
      setRecording(rec);
      setSeconds(0);
      timer.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (e) {
      setError(t('transcribe.micError', { error: e instanceof Error ? e.message : String(e) }));
    }
  }

  const busy = progress !== null;
  const pct = progress ? Math.round(progress.progress * 100) : 0;
  const selectClass = 'h-9 rounded-md border border-input bg-background px-2 text-sm';

  return (
    <section className="space-y-4" aria-labelledby="transcribe-title">
      <div>
        <h2 id="transcribe-title" className="flex items-center gap-2 text-xl font-semibold"><AudioLinesIcon className="h-5 w-5 text-primary" aria-hidden="true" />{t('transcribe.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('transcribe.subtitle')}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm" htmlFor="tr-lang">{t('transcribe.language')}</label>
        <select id="tr-lang" className={selectClass} value={lang} disabled={busy} onChange={(e) => setLang(e.target.value as WhisperLanguage)}>
          <option value="es">Español</option>
          <option value="en">English</option>
          <option value="pt">Português</option>
        </select>
        <label className="text-sm" htmlFor="tr-model">{t('transcribe.model')}</label>
        <select id="tr-model" className={selectClass} value={model} disabled={busy} onChange={(e) => setModel(e.target.value as WhisperModel)}>
          {MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {canRecord && (
          <Button variant={recording ? 'destructive' : 'default'} disabled={busy} onClick={() => void toggleRecording()} aria-pressed={recording !== null}>
            {recording ? <SquareIcon className="mr-1 h-4 w-4" aria-hidden="true" /> : <MicIcon className="mr-1 h-4 w-4" aria-hidden="true" />}
            {recording ? `${t('transcribe.stop')} · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : t('transcribe.record')}
          </Button>
        )}
        <Button variant="outline" disabled={busy || recording !== null} onClick={() => inputRef.current?.click()}>{t('transcribe.chooseFile')}</Button>
        <input ref={inputRef} type="file" className="sr-only" accept="audio/*,video/webm,video/mp4" onChange={(e) => { const f = e.target.files?.[0]; if (f) void transcribe(f); e.target.value = ''; }} />
      </div>
      {progress && (
        <div className="space-y-1" role="status" aria-live="polite">
          <p className="text-xs text-muted-foreground">{t(`transcribe.status.${progress.status}`) === `transcribe.status.${progress.status}` ? progress.status : t(`transcribe.status.${progress.status}`)} · {pct}%</p>
          <ProgressBar value={pct} label={t('transcribe.title')} />
        </div>
      )}
      {error && <Callout title="Error" variant="error" className="text-sm">{error}</Callout>}
      {transcript && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">{t('transcribe.result')} · {Math.round(transcript.durationSeconds)} s · {transcript.model.replace('Xenova/', '')}</p>
            <div className="ml-auto flex gap-1">
              <Button size="sm" variant="outline" onClick={() => { void navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }}><CopyIcon className="mr-1 h-4 w-4" aria-hidden="true" />{copied ? t('transcribe.copied') : t('transcribe.copy')}</Button>
              <Button size="sm" variant="outline" onClick={() => downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), 'transcripcion.txt')}><DownloadIcon className="mr-1 h-4 w-4" aria-hidden="true" />{t('transcribe.download')}</Button>
            </div>
          </div>
          <Textarea rows={12} value={text} onChange={(e) => setText(e.target.value)} className="font-mono text-xs" aria-label={t('transcribe.result')} />
        </div>
      )}
      <p className="text-xs text-muted-foreground">{t('transcribe.privacyNote')}</p>
    </section>
  );
}
