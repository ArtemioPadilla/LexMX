import * as React from 'react';
import { cn } from '@/lib/cn';

/**
 * ChatMessage — one turn in an AI conversation, styled by role.
 *
 * The agent-native UI kit (#204): Inceptor's identity is agent-orchestrated
 * development, so an honest chat surface is on-brand, not an afterthought.
 * Assistant turns are visually distinct and carry the `AIOutputLabel` slot
 * (passed as `footer`) so disclosure rides along with the content.
 */
export type ChatRole = 'user' | 'assistant';

export interface ChatMessageProps {
  /** Named `from` (not `role`) so it isn't mistaken for the DOM ARIA role. */
  from: ChatRole;
  children: React.ReactNode;
  /** Optional footer slot — typically <AIOutputLabel> or <AIFeedback> on assistant turns. */
  footer?: React.ReactNode;
  className?: string;
}

export function ChatMessage({ from, children, footer, className }: ChatMessageProps) {
  const isUser = from === 'user';
  return (
    <div
      className={cn('flex w-full gap-3', isUser ? 'justify-end' : 'justify-start', className)}
      data-role={from}
    >
      {!isUser && (
        <div
          aria-hidden="true"
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 font-mono text-[0.65rem] font-semibold text-primary"
        >
          AI
        </div>
      )}
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
          isUser
            ? 'rounded-br-sm bg-primary text-primary-foreground'
            : 'rounded-bl-sm bg-muted text-foreground',
        )}
      >
        <div className="whitespace-pre-wrap break-words">{children}</div>
        {footer && <div className="mt-2">{footer}</div>}
      </div>
    </div>
  );
}

/** How close to the true bottom (in px) still counts as "at the bottom". */
const NEAR_BOTTOM_THRESHOLD_PX = 120;

/**
 * Pure predicate extracted so it's unit-testable without a real layout
 * engine — jsdom reports `scrollHeight`/`scrollTop`/`clientHeight` as 0
 * always (it doesn't run layout), so this can only be exercised for real in
 * a browser. Tests stub the three metrics directly (see
 * `ai-kit.behavior.test.tsx`).
 */
export function isScrolledNearBottom(
  metrics: { scrollHeight: number; scrollTop: number; clientHeight: number },
  threshold = NEAR_BOTTOM_THRESHOLD_PX,
): boolean {
  const distanceFromBottom = metrics.scrollHeight - metrics.scrollTop - metrics.clientHeight;
  return distanceFromBottom <= threshold;
}

/** Vertical thread container with sensible spacing + an accessible live region. */
export function ChatThread({
  children,
  className,
  label = 'Conversation',
  scrollFade = true,
}: {
  children: React.ReactNode;
  className?: string;
  label?: string;
  /** Fade content near the top/bottom scroll edges — signals "more above/below". */
  scrollFade?: boolean;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  // Whether the user was near the bottom as of the last scroll event. Starts
  // `true` so the thread still auto-scrolls on first mount, before any
  // scroll event has fired.
  const nearBottomRef = React.useRef(true);
  const [showJumpToBottom, setShowJumpToBottom] = React.useState(false);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const handleScroll = () => {
      const nearBottom = isScrolledNearBottom(el);
      nearBottomRef.current = nearBottom;
      setShowJumpToBottom(!nearBottom);
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  // Runs after every render (new turn, or a streamed token appending to the
  // last turn). Only auto-scrolls when the user was already at (or near) the
  // bottom — otherwise a reader who scrolled up mid-stream to re-read history
  // would get yanked back down. If they've scrolled away, show a "new
  // messages" affordance instead of fighting their scroll position.
  // `scrollIntoView` scrolls the nearest scrollable ancestor, i.e. this
  // container when the caller applies `overflow-y-auto` to it (see
  // AIChatDemo). No `behavior: 'smooth'` on purpose: streaming re-renders as
  // often as every ~80ms, and queuing a smooth-scroll animation per token
  // makes the thread visibly stutter instead of tracking the last line.
  React.useEffect(() => {
    if (nearBottomRef.current) {
      bottomRef.current?.scrollIntoView({ block: 'end' });
    }
  });

  // Marks the user as "near bottom" and lets the render-effect above perform
  // the actual scroll — avoids double-scrolling (one here + one from the
  // re-render the state update triggers).
  function jumpToBottom() {
    nearBottomRef.current = true;
    setShowJumpToBottom(false);
  }

  return (
    <div
      ref={containerRef}
      role="log"
      aria-label={label}
      aria-live="polite"
      aria-relevant="additions text"
      className={cn('flex flex-col gap-4', scrollFade && 'scroll-fade-y', className)}
    >
      {children}
      <div ref={bottomRef} aria-hidden="true" />
      {showJumpToBottom && (
        <button
          type="button"
          onClick={jumpToBottom}
          className="sticky bottom-2 z-10 self-center rounded-full border border-border bg-background/95 px-3 py-1.5 text-xs font-medium shadow-md backdrop-blur transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Nuevos mensajes ↓
        </button>
      )}
    </div>
  );
}
