import * as React from 'react';
import { Loader2Icon } from 'lucide-react';

import { cn } from '@/lib/cn';

// Spinner — an inline loading indicator. Dependency-free (lucide + CSS spin).
// Uses role="status" + aria-label for a single announcement source.
// The sr-only span has been removed; aria-label on the role="status" element
// is sufficient and avoids the label being announced twice.
interface SpinnerProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Accessible label announced to screen readers. */
  label?: string;
}

function Spinner({ className, label = 'Loading', ...props }: SpinnerProps) {
  return (
    <span role="status" aria-label={label} className={cn('inline-flex', className)} {...props}>
      <Loader2Icon className="h-4 w-4 animate-spin text-current" />
    </span>
  );
}

export { Spinner };
