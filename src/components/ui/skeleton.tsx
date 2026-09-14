import * as React from 'react';

import { cn } from '@/lib/cn';

// Skeleton — a pulsing placeholder for loading states. Pure CSS, no primitive.
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />;
}

export { Skeleton };
