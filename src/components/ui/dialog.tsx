import * as React from 'react';
import { Dialog as BaseDialog } from '@base-ui-components/react/dialog';

import { cn } from '@/lib/cn';

// Dialog built on Base UI primitives instead of the Radix UI dialog package.
// Exposes a shadcn-compatible API so consumers don't need to learn a new surface.

// Base UI re-exports — no .displayName assignment; Base UI types don't carry that
// property and TS2339 fires. DevTools already shows the Base UI component name.
const Dialog = BaseDialog.Root;

const DialogTrigger = BaseDialog.Trigger;

const DialogClose = BaseDialog.Close;

// Portal wrapper — Base UI's Portal is used internally by Popup; we expose it
// as a passthrough component for API parity with shadcn.
const DialogPortal = BaseDialog.Portal;

// Backdrop (overlay) — maps to shadcn's DialogOverlay
const DialogOverlay = React.forwardRef<
  React.ComponentRef<typeof BaseDialog.Backdrop>,
  React.ComponentPropsWithoutRef<typeof BaseDialog.Backdrop>
>(({ className, ...props }, ref) => (
  <BaseDialog.Backdrop
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/80 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 transition-opacity',
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = 'DialogOverlay';

// Content maps to Base UI's Popup — the visible dialog panel
const DialogContent = React.forwardRef<
  React.ComponentRef<typeof BaseDialog.Popup>,
  React.ComponentPropsWithoutRef<typeof BaseDialog.Popup>
>(({ className, children, ...props }, ref) => (
  <BaseDialog.Portal>
    <DialogOverlay />
    <BaseDialog.Popup
      ref={ref}
      className={cn(
        'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
        'grid w-full max-w-lg gap-4 bg-background p-6 shadow-lg duration-200',
        'rounded-lg border',
        'data-[ending-style]:opacity-0 data-[ending-style]:scale-95',
        'data-[starting-style]:opacity-0 data-[starting-style]:scale-95',
        className,
      )}
      {...props}
    >
      {children}
    </BaseDialog.Popup>
  </BaseDialog.Portal>
));
DialogContent.displayName = 'DialogContent';

// Structural layout helpers — no Base UI mapping needed, plain divs
function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)}
      {...props}
    />
  );
}
DialogHeader.displayName = 'DialogHeader';

function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2',
        className,
      )}
      {...props}
    />
  );
}
DialogFooter.displayName = 'DialogFooter';

const DialogTitle = React.forwardRef<
  React.ComponentRef<typeof BaseDialog.Title>,
  React.ComponentPropsWithoutRef<typeof BaseDialog.Title>
>(({ className, ...props }, ref) => (
  <BaseDialog.Title
    ref={ref}
    className={cn('text-lg font-semibold leading-none tracking-tight', className)}
    {...props}
  />
));
DialogTitle.displayName = 'DialogTitle';

const DialogDescription = React.forwardRef<
  React.ComponentRef<typeof BaseDialog.Description>,
  React.ComponentPropsWithoutRef<typeof BaseDialog.Description>
>(({ className, ...props }, ref) => (
  <BaseDialog.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
));
DialogDescription.displayName = 'DialogDescription';

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
