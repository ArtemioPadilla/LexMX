import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Tailwind class merge helper (shadcn/Inceptor contract). Lives here, not in `src/lib/utils/`, which is a directory of runtime utilities. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
