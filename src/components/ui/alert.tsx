import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/cn';

// Alert — a persistent inline banner (distinct from the transient Toast and
// the Tremor-Raw Callout). Dependency-free.
const alertVariants = cva(
  'relative w-full rounded-lg border p-4 [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg~*]:pl-7 [&>svg]:size-4 [&>svg]:text-current',
  {
    variants: {
      variant: {
        default: 'bg-background text-foreground border-border',
        destructive: 'border-destructive/50 text-destructive [&>svg]:text-destructive',
        success: 'border-primary/40 text-primary [&>svg]:text-primary',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
));
Alert.displayName = 'Alert';

// Not a semantic heading element: AlertTitle is a title-styled leaf whose
// correct heading level depends entirely on where the consuming page places
// it in its own hierarchy (mirrors CardTitle's div-not-h* convention below).
// A hardcoded <h5> here previously produced Lighthouse/axe heading-order
// violations on pages whose surrounding structure never reaches an <h4>.
const AlertTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('mb-1 font-medium leading-none tracking-tight', className)} {...props} />
  ),
);
AlertTitle.displayName = 'AlertTitle';

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('text-sm opacity-90 [&_p]:leading-relaxed', className)} {...props} />
));
AlertDescription.displayName = 'AlertDescription';

export { Alert, AlertTitle, AlertDescription, alertVariants };
