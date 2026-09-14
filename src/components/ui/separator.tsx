import * as React from 'react';
import { Separator as BaseSeparator } from '@base-ui-components/react/separator';

import { cn } from '@/lib/cn';

// Separator built on Base UI's Separator primitive (NOT Radix). A semantic
// divider; `Divider` (Tremor-Raw) is the labeled variant.
const Separator = React.forwardRef<
  React.ComponentRef<typeof BaseSeparator>,
  React.ComponentPropsWithoutRef<typeof BaseSeparator> & {
    orientation?: 'horizontal' | 'vertical';
  }
>(({ className, orientation = 'horizontal', ...props }, ref) => (
  <BaseSeparator
    ref={ref}
    orientation={orientation}
    className={cn(
      'shrink-0 bg-border',
      orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
      className,
    )}
    {...props}
  />
));
Separator.displayName = 'Separator';

export { Separator };
