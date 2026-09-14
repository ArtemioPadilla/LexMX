import * as React from 'react';
import { cn } from '@/lib/cn';

// Hand-written label using a native <label> element to avoid the Radix UI label package.
// Matches shadcn's public API and styling conventions.
const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn(
      'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
      className,
    )}
    {...props}
  />
));
Label.displayName = 'Label';

export { Label };
