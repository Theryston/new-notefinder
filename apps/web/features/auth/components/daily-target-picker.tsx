'use client';

import type { DailyPracticeTargetSeconds } from '@vozzify/contracts/daily-target-rules';
import { DAILY_PRACTICE_TARGET_SECONDS } from '@vozzify/contracts/daily-target-rules';
import { useTranslations } from 'next-intl';
import { useId } from 'react';

import { cn } from '@/lib/utils';

/**
 * The Daily target presets as a segmented control (DESIGN.md). Native radios
 * sharing one name, so the group is operable by keyboard and announced as a
 * radio group with no extra wiring. Only the four presets are expressible:
 * there is no custom, fractional or hour-based input. Controlled from the
 * form value, which also carries the pre-selected preset. State is shown by
 * shape (the `bg-background` thumb), never by orange.
 */
export function DailyTargetPicker({
  selected,
  name,
  onPick,
  onBlur,
}: {
  selected: number | undefined;
  name: string;
  onPick: (seconds: DailyPracticeTargetSeconds) => void;
  onBlur: () => void;
}) {
  const t = useTranslations('profile.edit.dailyTarget');
  const descriptionId = useId();

  return (
    <fieldset aria-describedby={descriptionId}>
      <legend className="font-semibold text-[0.8125rem] text-foreground">
        {t('label')}
      </legend>
      <p id={descriptionId} className="mt-1 text-muted-foreground text-sm">
        {t('description')}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-0.5 rounded-2xl bg-muted p-0.75 sm:grid-cols-4 sm:rounded-full">
        {DAILY_PRACTICE_TARGET_SECONDS.map((seconds) => {
          const minutes = seconds / 60;
          return (
            <label key={seconds} className="relative cursor-pointer">
              <input
                type="radio"
                name={name}
                value={seconds}
                className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0"
                checked={selected === seconds}
                onChange={() => onPick(seconds)}
                onBlur={onBlur}
              />
              <span
                className={cn(
                  'flex h-10 items-center justify-center rounded-xl px-2.5 text-center tabular-nums sm:rounded-full',
                  'font-semibold text-[0.8125rem]',
                  'text-muted-foreground transition-[color,background-color,box-shadow] duration-150 ease-out hover:text-foreground',
                  'peer-checked:bg-background peer-checked:text-foreground peer-checked:shadow-sm',
                  'peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50',
                )}
              >
                {t('minutes', { minutes })}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
