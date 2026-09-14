import * as React from 'react';
import { cn } from '@/lib/cn';

/**
 * ErrorState — a structured error placeholder for list and data-fetching
 * islands. Complements EmptyState: use EmptyState for zero-data / filtered-
 * to-empty, and ErrorState for actual fetch failures.
 *
 * Props are intentionally minimal — the caller provides the icon, title,
 * hint (human-readable cause), and an optional action slot (e.g. a Retry
 * button). This keeps the component presentation-only and reusable across
 * different error types (rate-limit, auth, network, server).
 *
 * Accessibility: the container has role="alert" so screen readers announce
 * it immediately when it appears in the DOM.
 */
interface ErrorStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  icon?: React.ReactNode;
  title: React.ReactNode;
  /** Short explanation of what went wrong and/or what the user can do. */
  hint?: React.ReactNode;
  /** Action slot — typically a Retry button or a link to docs. */
  action?: React.ReactNode;
}

function ErrorState({ icon, title, hint, action, className, ...props }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-destructive/30 bg-destructive/5 px-6 py-12 text-center',
        className,
      )}
      {...props}
    >
      {icon && (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive [&>svg]:size-6">
          {icon}
        </div>
      )}
      <p className="font-medium text-foreground">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export { ErrorState };
