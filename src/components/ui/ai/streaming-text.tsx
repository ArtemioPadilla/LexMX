import * as React from 'react';
import { cn } from '@/lib/cn';

/**
 * ThinkingIndicator — the "AI is working" affordance shown before the first
 * token arrives. Pulsing dots over a `shimmer` sweep on the pill background.
 * Both respect prefers-reduced-motion (dots via `motion-safe:`, shimmer via
 * its own media query in global.css — see the `.shimmer` utility).
 */
export function ThinkingIndicator({ label = 'Pensando…', className }: { label?: string; className?: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn(
        'shimmer flex w-fit items-center gap-1.5 rounded-full bg-muted/60 px-3 py-1.5',
        className,
      )}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          aria-hidden="true"
          className="h-1.5 w-1.5 rounded-full bg-muted-foreground/70 motion-safe:animate-pulse"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}

/**
 * StreamingText — renders progressively-arriving text with a blinking caret
 * while `streaming` is true. The caret disappears once streaming completes.
 * Purely presentational: the parent owns the token accumulation.
 */
export function StreamingText({
  text,
  streaming = false,
  className,
}: {
  text: string;
  streaming?: boolean;
  className?: string;
}) {
  if (!text && streaming) return <ThinkingIndicator />;
  return (
    <span className={cn('whitespace-pre-wrap break-words', className)}>
      {text}
      {streaming && (
        <span
          aria-hidden="true"
          className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 bg-current motion-safe:animate-pulse"
        />
      )}
    </span>
  );
}
