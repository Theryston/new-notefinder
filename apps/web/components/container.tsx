import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

/**
 * The page column the header bar, the content and the footer all sit in, so
 * their edges line up at every width: the gutter (`px-4`, `px-6` from `md`)
 * outside, the content up to `max-w-7xl` inside. Pages don't add their own
 * horizontal padding.
 */
export function Container({
  className,
  children,
  ...props
}: ComponentProps<'div'>) {
  return (
    <div className="px-4 md:px-6">
      <div className={cn('mx-auto max-w-7xl', className)} {...props}>
        {children}
      </div>
    </div>
  );
}
