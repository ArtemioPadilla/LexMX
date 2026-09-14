import * as React from 'react';
import { SparklesIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * AIOutputLabel — the disclosure affordance for AI-generated content.
 *
 * This is an ethics requirement, not decoration (see docs/ETHICS.md §1 intent
 * + the persuasive-design checklist): AI output must be labeled as such, and
 * low-confidence output must say so. The default copy carries a
 * "verify before acting" nudge; pass `confidence="low"` to surface a stronger
 * caution.
 */
export interface AIOutputLabelProps {
  /** Optional model/source attribution, e.g. "Claude Opus 4.8". */
  source?: string;
  confidence?: 'normal' | 'low';
  className?: string;
}

export function AIOutputLabel({ source, confidence = 'normal', className }: AIOutputLabelProps) {
  const low = confidence === 'low';
  return (
    <p
      className={cn(
        'flex items-center gap-1.5 text-[0.7rem]',
        low ? 'text-destructive' : 'text-muted-foreground',
        className,
      )}
    >
      <SparklesIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span>
        {source ? `Generado por ${source}. ` : 'Generado por IA. '}
        {low
          ? 'Confianza baja — verifica antes de actuar.'
          : 'Puede contener errores; verifica antes de actuar.'}
      </span>
    </p>
  );
}
