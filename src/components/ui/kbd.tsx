import * as React from 'react';

import { cn } from '@/lib/cn';

// Kbd — renders a keyboard key hint. Dependency-free.
function Kbd({ className, ...props }: React.ComponentProps<'kbd'>) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 select-none items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-[0.7rem] font-medium text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
}

export { Kbd };
