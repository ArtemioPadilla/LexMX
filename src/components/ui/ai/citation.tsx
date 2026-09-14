import * as React from 'react';
import { LinkIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Citation — source-attribution for AI answers.
 *
 * Pairs an inline numbered marker (`CitationRef`, dropped next to the claim
 * it backs) with a footer list (`CitationList`, passed as `ChatMessage`'s
 * `footer` slot alongside `AIOutputLabel`/`AIFeedback`). No citation-matching
 * logic — callers own the mapping from claim to source index; this is
 * presentation only, matching the visual language of `ai-output-label.tsx`
 * (small muted type, `text-[0.7rem]`) and `chat-message.tsx` (footer slot).
 */
export interface CitationSource {
  /** Human-readable attribution, e.g. "Estado de cuenta — agosto 2026". */
  label: string;
  /** Optional deep link to the source. Renders as plain text when absent. */
  url?: string;
}

export interface CitationRefProps {
  /** 1-based index into the sibling `CitationList`'s `sources` array. */
  index: number;
  className?: string;
}

/** Inline numbered reference, e.g. "...grew 12%[1]." Purely visual — not a live link. */
export function CitationRef({ index, className }: CitationRefProps) {
  return (
    <sup className={cn('ml-0.5 font-mono text-[0.65rem] font-semibold text-primary', className)}>
      [{index}]
    </sup>
  );
}

export interface CitationListProps {
  sources: CitationSource[];
  className?: string;
}

/** Footer list of sources for an assistant `ChatMessage` — numbering matches `CitationRef`. */
export function CitationList({ sources, className }: CitationListProps) {
  if (sources.length === 0) return null;
  return (
    <ol
      aria-label="Fuentes"
      className={cn(
        'space-y-1 border-t border-border/60 pt-2 text-[0.7rem] text-muted-foreground',
        className,
      )}
    >
      {sources.map((source, i) => (
        <li key={`${source.label}-${i}`} className="flex items-start gap-1.5">
          <span aria-hidden="true" className="font-mono text-primary">
            [{i + 1}]
          </span>
          {source.url ? (
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 underline-offset-2 hover:text-foreground hover:underline"
            >
              {source.label}
              <LinkIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
            </a>
          ) : (
            <span>{source.label}</span>
          )}
        </li>
      ))}
    </ol>
  );
}
