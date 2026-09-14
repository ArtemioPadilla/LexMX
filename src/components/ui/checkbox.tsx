import * as React from 'react';
import { Checkbox as BaseCheckbox } from '@base-ui-components/react/checkbox';
import { CheckIcon, MinusIcon } from 'lucide-react';

import { cn } from '@/lib/cn';

// Checkbox built on Base UI's Checkbox primitive (NOT Radix). shadcn-compatible.
// Base UI sets data-[indeterminate] on the Root when indeterminate=true, and
// data-[checked] when checked. We render different icons per state via the
// Indicator's render prop which receives { checked, indeterminate }.
const Checkbox = React.forwardRef<
  React.ComponentRef<typeof BaseCheckbox.Root>,
  React.ComponentPropsWithoutRef<typeof BaseCheckbox.Root>
>(({ className, ...props }, ref) => (
  <BaseCheckbox.Root
    ref={ref}
    className={cn(
      'peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'data-[checked]:bg-primary data-[checked]:text-primary-foreground',
      'data-[indeterminate]:bg-primary data-[indeterminate]:text-primary-foreground',
      className,
    )}
    {...props}
  >
    <BaseCheckbox.Indicator
      className="flex items-center justify-center text-current"
      render={(indicatorProps, state) => (
        <span {...indicatorProps}>
          {/* Show Minus for indeterminate, Check for checked */}
          {state.indeterminate ? (
            <MinusIcon className="h-3.5 w-3.5" />
          ) : (
            <CheckIcon className="h-3.5 w-3.5" />
          )}
        </span>
      )}
    />
  </BaseCheckbox.Root>
));
Checkbox.displayName = 'Checkbox';

export { Checkbox };
