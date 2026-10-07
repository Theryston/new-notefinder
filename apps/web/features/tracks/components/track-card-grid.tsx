import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

const GRID_CLASS =
  'grid grid-cols-2 gap-2 transition-opacity duration-150 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7';

/**
 * The single cover-grid behind every track surface (Search today, the
 * Artist list next): identical responsive density everywhere, with the
 * stale dimming plus inert behavior Search uses while a new query fetches
 * over known results.
 */
export function TrackCardGrid({
  children,
  stale,
}: {
  children: ReactNode;
  stale?: boolean;
}) {
  return (
    <div
      data-stale={stale || undefined}
      aria-busy={stale}
      inert={stale}
      className={cn(GRID_CLASS, stale && 'pointer-events-none opacity-50')}
    >
      {children}
    </div>
  );
}
