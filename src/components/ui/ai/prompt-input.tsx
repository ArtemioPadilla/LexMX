import * as React from 'react';
import { SendIcon, SquareIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * PromptInput — auto-growing textarea + send control for AI surfaces.
 *
 * - Enter submits; Shift+Enter inserts a newline (the chat convention).
 * - While `streaming`, the send button becomes a Stop button and Enter is
 *   ignored, so the user can't fire a second request mid-generation.
 */
export interface PromptInputProps {
  value: string;
  onValueChange: (v: string) => void;
  onSubmit: () => void;
  /** True while a response is generating — flips Send→Stop and blocks submit. */
  streaming?: boolean;
  onStop?: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** data-testid for the textarea (LexMX e2e contract). */
  textareaTestId?: string;
  /** data-testid for the send button. */
  sendTestId?: string;
  /** Extra controls rendered before the send button (e.g. dictation). */
  extra?: React.ReactNode;
  /** Fired when the textarea gains focus (used to prefetch heavy models on intent). */
  onFocus?: () => void;
}

export function PromptInput({
  value,
  onValueChange,
  onSubmit,
  streaming = false,
  onStop,
  placeholder = 'Ask anything…',
  disabled = false,
  className,
  textareaTestId,
  sendTestId,
  extra,
  onFocus,
}: PromptInputProps) {
  const ref = React.useRef<HTMLTextAreaElement>(null);

  // Auto-grow: reset to auto then snap to scrollHeight, capped so it can't
  // eat the viewport. Runs on every value change.
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  const canSend = value.trim().length > 0 && !disabled;

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (streaming || !canSend) return;
      onSubmit();
    }
  }

  return (
    <div
      className={cn(
        'flex items-end gap-2 rounded-2xl border border-input bg-background p-2',
        'focus-within:ring-2 focus-within:ring-ring',
        className,
      )}
    >
      <textarea
        ref={ref}
        rows={1}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        aria-label="Prompt"
        data-testid={textareaTestId}
        onChange={(e) => onValueChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={onFocus}
        className="max-h-[200px] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
      />
      {extra}
      {streaming ? (
        <button
          type="button"
          onClick={onStop}
          aria-label="Stop generating"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <SquareIcon className="h-4 w-4 fill-current" />
        </button>
      ) : (
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSend}
          aria-label="Send"
          data-testid={sendTestId}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <SendIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
