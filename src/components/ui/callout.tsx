import * as React from 'react';

import { cn } from '@/lib/cn';

export interface CalloutProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  variant?: 'default' | 'success' | 'warning' | 'error';
  /** Optional icon node (e.g. a Lucide icon element) shown beside the title. */
  icon?: React.ReactNode;
}

// variantStyles maps each Callout variant to border + background classes.
// success/warning use OKLCH arbitrary values (no semantic shadcn var exists for
// these states). error uses the --destructive var for theme-consistency.
const variantStyles: Record<NonNullable<CalloutProps['variant']>, string> = {
  default: 'border-border bg-card',
  success:
    'border-[oklch(0.7_0.15_140/0.4)] bg-[oklch(0.7_0.15_140/0.1)]',
  warning:
    'border-[oklch(0.75_0.18_70/0.4)] bg-[oklch(0.75_0.18_70/0.1)]',
  error: 'border-destructive/40 bg-destructive/10',
};

// Callout is an informational box with a bold title, optional icon, and body
// content via children. Modelled on Tremor Raw's <Callout> API.
export const Callout = React.forwardRef<HTMLDivElement, CalloutProps>(
  ({ title, variant = 'default', icon, children, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-lg border p-4',
        variantStyles[variant],
        className,
      )}
      {...props}
    >
      <div className="flex items-center gap-2 mb-1">
        {icon && <span className="shrink-0">{icon}</span>}
        <p className="text-sm font-semibold text-foreground">{title}</p>
      </div>
      {children && (
        <div className="text-sm text-muted-foreground">{children}</div>
      )}
    </div>
  ),
);
Callout.displayName = 'Callout';
