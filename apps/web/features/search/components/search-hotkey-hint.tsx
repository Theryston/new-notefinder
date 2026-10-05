import { CommandIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * The `⌘K` keycap. It is the same on every platform (`Ctrl K` works too, see
 * `isSearchHotkey`), so the server can render it as is.
 */
export function SearchHotkeyHint({ className }: { className?: string }) {
  return (
    // Hidden from screen readers: the field announces the shortcut through
    // `aria-keyshortcuts`.
    <span aria-hidden="true" className={cn('pointer-events-none', className)}>
      <kbd className="inline-flex items-center gap-0.5 rounded-xs border border-border bg-background px-1.5 py-px font-medium font-mono text-[0.6875rem] text-muted-foreground">
        <CommandIcon className="size-3" />K
      </kbd>
    </span>
  );
}
