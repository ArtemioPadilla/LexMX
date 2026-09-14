import * as React from 'react';
import { Tooltip as BaseTooltip } from '@base-ui-components/react/tooltip';

import { cn } from '@/lib/cn';

// Tooltip built on Base UI's Tooltip primitive (NOT Radix).
// Wrap an app (or a section) in <TooltipProvider> once, then use Tooltip/
// TooltipTrigger/TooltipContent per element.
const TooltipProvider = BaseTooltip.Provider;
const Tooltip = BaseTooltip.Root;
const TooltipTrigger = BaseTooltip.Trigger;

const TooltipContent = React.forwardRef<
  React.ComponentRef<typeof BaseTooltip.Popup>,
  React.ComponentPropsWithoutRef<typeof BaseTooltip.Popup> & { sideOffset?: number }
>(({ className, sideOffset = 6, children, ...props }, ref) => (
  <BaseTooltip.Portal>
    <BaseTooltip.Positioner sideOffset={sideOffset} className="z-50">
      <BaseTooltip.Popup
        ref={ref}
        className={cn(
          'rounded-md border border-border bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-md',
          'origin-[var(--transform-origin)] transition-[transform,opacity] data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 data-[starting-style]:scale-95',
          className,
        )}
        {...props}
      >
        {children}
      </BaseTooltip.Popup>
    </BaseTooltip.Positioner>
  </BaseTooltip.Portal>
));
TooltipContent.displayName = 'TooltipContent';

export { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent };
