import * as React from 'react';
import { CheckIcon } from 'lucide-react';

import { cn } from '@/lib/cn';

// Stepper — a horizontal multi-step progress indicator. Dependency-free markup.
interface StepperProps extends React.HTMLAttributes<HTMLOListElement> {
  steps: string[];
  /** Zero-based index of the current step. */
  current: number;
}

function Stepper({ steps, current, className, ...props }: StepperProps) {
  return (
    <ol className={cn('flex items-center', className)} {...props}>
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className={cn('flex items-center', i < steps.length - 1 && 'flex-1')}>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs font-medium',
                  done && 'border-primary bg-primary text-primary-foreground',
                  active && 'border-primary text-primary',
                  !done && !active && 'border-border text-muted-foreground',
                )}
              >
                {done ? <CheckIcon className="h-4 w-4" /> : i + 1}
              </span>
              <span
                className={cn(
                  'whitespace-nowrap text-sm',
                  active ? 'font-medium text-foreground' : 'text-muted-foreground',
                )}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <span className={cn('mx-3 h-px flex-1', done ? 'bg-primary' : 'bg-border')} />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export { Stepper };
