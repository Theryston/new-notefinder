import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export type SegmentedOption = {
  value: string;
  /** Accessible name; the visible `content` is often just an icon or code. */
  label: string;
  content: ReactNode;
  lang?: string;
};

/**
 * A pill segmented control for the glass header and footer: a `bg-muted`
 * track with a `bg-background` thumb under the pressed option. `value` is
 * `null` while it isn't known yet (before hydration): nothing is pressed.
 */
export function SegmentedControl({
  label,
  value,
  options,
  onChange,
  className,
  buttonClassName,
}: {
  label: string;
  value: string | null;
  options: SegmentedOption[];
  onChange: (value: string) => void;
  /** Extra classes for the track (the pill around the options), e.g. its `gap`. */
  className?: string;
  buttonClassName?: string;
}) {
  return (
    <fieldset
      className={cn(
        'inline-flex gap-0.5 rounded-full bg-muted p-0.75',
        className,
      )}
    >
      <legend className="sr-only">{label}</legend>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          lang={option.lang}
          aria-label={option.label}
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={cn(
            'inline-flex h-7.5 min-w-7 items-center justify-center rounded-full text-muted-foreground outline-none transition-[color,background-color,box-shadow] duration-150 ease-out hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-sm',
            buttonClassName,
          )}
        >
          {option.content}
        </button>
      ))}
    </fieldset>
  );
}
