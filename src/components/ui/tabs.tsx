import * as React from 'react';
import { Tabs as BaseTabs } from '@base-ui-components/react/tabs';

import { cn } from '@/lib/cn';

// Tabs built on Base UI's Tabs primitive instead of the Radix UI tabs package.
// Exposes a shadcn-compatible API surface.

const Tabs = React.forwardRef<
  React.ComponentRef<typeof BaseTabs.Root>,
  React.ComponentPropsWithoutRef<typeof BaseTabs.Root>
>(({ className, ...props }, ref) => (
  <BaseTabs.Root
    ref={ref}
    className={cn('flex flex-col', className)}
    {...props}
  />
));
Tabs.displayName = 'Tabs';

const TabsList = React.forwardRef<
  React.ComponentRef<typeof BaseTabs.List>,
  React.ComponentPropsWithoutRef<typeof BaseTabs.List>
>(({ className, ...props }, ref) => (
  <BaseTabs.List
    ref={ref}
    className={cn(
      'inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground',
      className,
    )}
    {...props}
  />
));
TabsList.displayName = 'TabsList';

const TabsTrigger = React.forwardRef<
  React.ComponentRef<typeof BaseTabs.Tab>,
  React.ComponentPropsWithoutRef<typeof BaseTabs.Tab>
>(({ className, ...props }, ref) => (
  <BaseTabs.Tab
    ref={ref}
    className={cn(
      'inline-flex cursor-pointer items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium',
      'ring-offset-background transition-all',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      'disabled:pointer-events-none disabled:opacity-50',
      // Hover highlight for the non-selected tabs (selected keeps its solid bg).
      'not-data-[selected]:hover:bg-background/60 not-data-[selected]:hover:text-foreground',
      'data-[selected]:bg-background data-[selected]:text-foreground data-[selected]:shadow-sm',
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = 'TabsTrigger';

const TabsContent = React.forwardRef<
  React.ComponentRef<typeof BaseTabs.Panel>,
  React.ComponentPropsWithoutRef<typeof BaseTabs.Panel>
>(({ className, ...props }, ref) => (
  <BaseTabs.Panel
    ref={ref}
    className={cn(
      'mt-2 ring-offset-background',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = 'TabsContent';

export { Tabs, TabsContent, TabsList, TabsTrigger };
