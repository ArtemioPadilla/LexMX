import * as React from 'react';
import { RadioGroup as BaseRadioGroup } from '@base-ui-components/react/radio-group';
import { Radio as BaseRadio } from '@base-ui-components/react/radio';

import { cn } from '@/lib/cn';

// Radio group built on Base UI's RadioGroup + Radio primitives (NOT Radix).
const RadioGroup = React.forwardRef<
  React.ComponentRef<typeof BaseRadioGroup>,
  React.ComponentPropsWithoutRef<typeof BaseRadioGroup>
>(({ className, ...props }, ref) => (
  <BaseRadioGroup ref={ref} className={cn('grid gap-2', className)} {...props} />
));
RadioGroup.displayName = 'RadioGroup';

const RadioGroupItem = React.forwardRef<
  React.ComponentRef<typeof BaseRadio.Root>,
  React.ComponentPropsWithoutRef<typeof BaseRadio.Root>
>(({ className, ...props }, ref) => (
  <BaseRadio.Root
    ref={ref}
    className={cn(
      'aspect-square h-4 w-4 rounded-full border border-primary text-primary ring-offset-background',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'data-[checked]:bg-primary',
      className,
    )}
    {...props}
  >
    <BaseRadio.Indicator className="flex items-center justify-center">
      <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
    </BaseRadio.Indicator>
  </BaseRadio.Root>
));
RadioGroupItem.displayName = 'RadioGroupItem';

export { RadioGroup, RadioGroupItem };
