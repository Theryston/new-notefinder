import { cn } from 'cn';
import type * as React from 'react';

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn('animate-pulse rounded-full bg-muted', className)}
      {...props}
    />
  );
}

export { Skeleton };
