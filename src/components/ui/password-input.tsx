import * as React from 'react';
import { EyeIcon, EyeOffIcon } from 'lucide-react';

import { cn } from '@/lib/cn';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

// PasswordInput wraps Input with a reveal/hide toggle (ROADMAP Epic 21).
export type PasswordInputProps = Omit<React.ComponentProps<typeof Input>, 'type'>;

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);

    return (
      <div className="relative">
        <Input
          ref={ref}
          type={visible ? 'text' : 'password'}
          className={cn('pr-10', className)}
          {...props}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-0 top-0 h-10 w-10 text-muted-foreground hover:bg-transparent hover:text-foreground"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
        >
          {visible ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
        </Button>
      </div>
    );
  },
);
PasswordInput.displayName = 'PasswordInput';

export { PasswordInput };
