'use client';

import { useSyncExternalStore } from 'react';

import { cn } from '@/lib/utils';

import { searchHotkeyLabel } from '../search-hotkey';

const noSubscription = () => () => {};

/**
 * `⌘K` or `Ctrl K`, depending on the platform. The server can't know it, so
 * the hint shows up after hydration (same width either way, no shift).
 */
export function SearchHotkeyHint({ className }: { className?: string }) {
  const label = useSyncExternalStore(
    noSubscription,
    () => searchHotkeyLabel(navigator.platform),
    () => null,
  );

  return (
    // Hidden from screen readers: the field announces the shortcut through
    // `aria-keyshortcuts`.
    <span
      aria-hidden="true"
      className={cn(
        'pointer-events-none h-6 min-w-12 items-center justify-center rounded-full bg-background px-2 font-medium text-muted-foreground text-xs shadow-xs',
        label ? '' : 'invisible',
        className,
      )}
    >
      <kbd className="font-sans">{label ?? 'Ctrl K'}</kbd>
    </span>
  );
}
