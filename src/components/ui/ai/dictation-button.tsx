import * as React from 'react';
import { MicIcon, MicOffIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { dictationSupported, startDictation, type DictationHandle } from '@/lib/speech/dictation';
import { recordingSupported, startRecording, type Recording } from '@/lib/speech/recorder';

/**
 * DictationButton — dictation into a prompt. Uses the browser's
 * SpeechRecognition when it exists (live, may reach the browser vendor);
 * otherwise records on the device and transcribes with local Whisper.
 * Renders nothing when neither is available. Opt-in per click; the label
 * says which engine runs.
 */
export interface DictationButtonProps {
  locale: string;
  /** Called with the running transcript; `final` when recognition settled. */
  onTranscript: (text: string, final: boolean) => void;
  labels: {
    start: string;
    stop: string;
    note: string;
    /** Local Whisper variant (used when SpeechRecognition is missing). */
    local?: { start: string; stop: string; note: string; busy: string };
  };
  disabled?: boolean;
  className?: string;
}

export function DictationButton({ locale, onTranscript, labels, disabled, className }: DictationButtonProps) {
  const [engine, setEngine] = React.useState<'browser' | 'local' | null>(null);
  const [listening, setListening] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const handle = React.useRef<DictationHandle | null>(null);
  const recording = React.useRef<Recording | null>(null);

  // `labels` is a fresh object every render; depend on a boolean so the
  // cleanup (which stops a live dictation) only runs on unmount.
  const hasLocal = Boolean(labels.local);
  React.useEffect(() => {
    setEngine(dictationSupported() ? 'browser' : recordingSupported() && hasLocal ? 'local' : null);
    return () => {
      handle.current?.stop();
      void recording.current?.stop();
    };
  }, [hasLocal]);

  if (!engine) return null;

  async function toggle() {
    if (engine === 'browser') {
      if (listening) {
        handle.current?.stop();
        handle.current = null;
        setListening(false);
        return;
      }
      handle.current = startDictation(locale, {
        onResult: onTranscript,
        onEnd: () => { handle.current = null; setListening(false); },
        onError: () => { handle.current = null; setListening(false); },
      });
      setListening(handle.current !== null);
      return;
    }
    if (listening && recording.current) {
      const blob = await recording.current.stop();
      recording.current = null;
      setListening(false);
      setBusy(true);
      try {
        const { transcribeAudio, whisperLanguage } = await import('@/lib/speech/whisper');
        const result = await transcribeAudio(blob, { language: whisperLanguage(locale) });
        onTranscript(result.text, true);
      } catch {
        // Transcription failed: leave the prompt untouched.
      } finally {
        setBusy(false);
      }
      return;
    }
    try {
      recording.current = await startRecording();
      setListening(true);
    } catch {
      recording.current = null;
      setListening(false);
    }
  }

  const l = engine === 'local' && labels.local ? labels.local : labels;
  const name = busy && labels.local ? labels.local.busy : listening ? l.stop : l.start;

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={disabled || busy}
      aria-pressed={listening}
      aria-busy={busy}
      aria-label={name}
      title={`${name}. ${l.note}`}
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40',
        listening ? 'bg-destructive text-destructive-foreground animate-pulse' : 'bg-muted text-foreground hover:bg-accent',
        className,
      )}
    >
      {listening ? <MicOffIcon className="h-4 w-4" /> : <MicIcon className="h-4 w-4" />}
    </button>
  );
}
