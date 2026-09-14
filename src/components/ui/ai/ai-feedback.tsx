import * as React from 'react';
import { ThumbsUpIcon, ThumbsDownIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * AIFeedback — thumbs up/down on an AI response, with an optional reason box
 * on a down-vote. The closing of the loop (Fogg's reciprocity): when the user
 * flags a bad answer, route the signal somewhere real — `onSubmit` is wired
 * in the demo to the same prefilled-GitHub-issue path the FeedbackFAB uses.
 */
export interface AIFeedbackProps {
  onSubmit: (vote: 'up' | 'down', reason?: string) => void;
  className?: string;
}

export function AIFeedback({ onSubmit, className }: AIFeedbackProps) {
  const [vote, setVote] = React.useState<'up' | 'down' | null>(null);
  const [reason, setReason] = React.useState('');
  const [sent, setSent] = React.useState(false);

  if (sent) {
    return <p className={cn('text-[0.7rem] text-muted-foreground', className)}>Gracias por tu feedback.</p>;
  }

  function choose(v: 'up' | 'down') {
    setVote(v);
    if (v === 'up') {
      onSubmit('up');
      setSent(true);
    }
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-1">
        <span className="mr-1 text-[0.7rem] text-muted-foreground">¿Útil?</span>
        <button
          type="button"
          aria-label="Respuesta útil"
          aria-pressed={vote === 'up'}
          onClick={() => choose('up')}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:text-primary"
        >
          <ThumbsUpIcon className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-label="Respuesta no útil"
          aria-pressed={vote === 'down'}
          onClick={() => setVote('down')}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:text-destructive"
        >
          <ThumbsDownIcon className="h-3.5 w-3.5" />
        </button>
      </div>
      {vote === 'down' && (
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit('down', reason.trim() || undefined);
            setSent(true);
          }}
        >
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            aria-label="Qué salió mal"
            placeholder="¿Qué salió mal? (opcional)"
            className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button
            type="submit"
            className="rounded-md bg-muted px-2 py-1 text-xs font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Enviar
          </button>
        </form>
      )}
    </div>
  );
}
