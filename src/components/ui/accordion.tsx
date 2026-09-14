import * as React from 'react';
import { Accordion as BaseAccordion } from '@base-ui-components/react/accordion';
import { ChevronDownIcon } from 'lucide-react';

import { cn } from '@/lib/cn';

// Accordion built on Base UI's Accordion primitive (NOT Radix).
const Accordion = BaseAccordion.Root;

const AccordionItem = React.forwardRef<
  React.ComponentRef<typeof BaseAccordion.Item>,
  React.ComponentPropsWithoutRef<typeof BaseAccordion.Item>
>(({ className, ...props }, ref) => (
  <BaseAccordion.Item ref={ref} className={cn('border-b border-border', className)} {...props} />
));
AccordionItem.displayName = 'AccordionItem';

const AccordionTrigger = React.forwardRef<
  React.ComponentRef<typeof BaseAccordion.Trigger>,
  React.ComponentPropsWithoutRef<typeof BaseAccordion.Trigger>
>(({ className, children, ...props }, ref) => (
  <BaseAccordion.Header className="flex">
    <BaseAccordion.Trigger
      ref={ref}
      className={cn(
        'group flex flex-1 items-center justify-between py-4 text-sm font-medium transition-all',
        'hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
      {...props}
    >
      {children}
      {/* data-panel-open is set on the Trigger by Base UI; group-data-[panel-open] reads it */}
      <ChevronDownIcon className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[panel-open]:rotate-180" />
    </BaseAccordion.Trigger>
  </BaseAccordion.Header>
));
AccordionTrigger.displayName = 'AccordionTrigger';

const AccordionContent = React.forwardRef<
  React.ComponentRef<typeof BaseAccordion.Panel>,
  React.ComponentPropsWithoutRef<typeof BaseAccordion.Panel>
>(({ className, children, ...props }, ref) => (
  <BaseAccordion.Panel
    ref={ref}
    className={cn(
      'overflow-hidden text-sm text-muted-foreground',
      'h-[var(--accordion-panel-height)] transition-[height] duration-200 ease-out',
      'data-[starting-style]:h-0 data-[ending-style]:h-0',
      className,
    )}
    {...props}
  >
    <div className="pb-4">{children}</div>
  </BaseAccordion.Panel>
));
AccordionContent.displayName = 'AccordionContent';

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
