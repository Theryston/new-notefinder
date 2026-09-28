import type { ComponentProps } from 'react';

import { Link } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils';

/** Short inline link in body text (orange, semibold, per DESIGN.md). */
export function TextLink({ className, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link
      className={cn(
        'rounded-full font-semibold text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50',
        className,
      )}
      {...props}
    />
  );
}
