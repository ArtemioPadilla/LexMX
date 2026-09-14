import * as React from 'react';

import { cn } from '@/lib/cn';

export interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Completion percentage, clamped to [0, 100]. */
  value: number;
  /** Accessible name for screen readers. */
  label?: string;
}

// ProgressBar renders a horizontal track + filled inner bar using semantic
// ARIA attributes. Colors come from shadcn CSS vars so dark mode is automatic.
export const ProgressBar = React.forwardRef<HTMLDivElement, ProgressBarProps>(
  ({ value, label, className, ...props }, ref) => {
    // Clamp to [0, 100] so invalid inputs never break the layout.
    const clamped = Math.min(100, Math.max(0, value));

    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className={cn('w-full overflow-hidden rounded-full bg-muted h-2', className)}
        {...props}
      >
        <div
          className="h-full rounded-full bg-primary transition-all duration-300 ease-in-out"
          style={{ width: `${clamped}%` }}
        />
      </div>
    );
  },
);
ProgressBar.displayName = 'ProgressBar';
