import * as React from 'react';
import { MicIcon, MicOffIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { dictationSupported, startDictation, type DictationHandle } from '@/lib/speech/dictation';

/**
 * DictationButton — toggles browser speech recognition into a prompt.
 * Renders nothing when the browser has no SpeechRecognition. Opt-in per
 * click; the label says audio may go to the browser vendor.
 */
export interface DictationButtonProps {
  locale: string;
  /** Called with the running transcript; `final` when recognition settled. */
  onTranscript: (text: string, final: boolean) => void;
  labels: { start: string; stop: string; note: string };
  disabled?: boolean;
  className?: string;
}

export function DictationButton({ locale, onTranscript, labels, disabled, className }: DictationButtonProps) {
  const [supported, setSupported] = React.useState(false);
  const [listening, setListening] = React.useState(false);
  const handle = React.useRef<DictationHandle | null>(null);

  React.useEffect(() => {
    setSupported(dictationSupported());
    return () => handle.current?.stop();
  }, []);

  if (!supported) return null;

  function toggle() {
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
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled}
      aria-pressed={listening}
      aria-label={listening ? labels.stop : labels.start}
      title={`${listening ? labels.stop : labels.start}. ${labels.note}`}
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
