'use client';

import { DAILY_PRACTICE_TARGET_SECONDS } from '@notefinder/contracts/daily-target-rules';
import { useTranslations } from 'next-intl';
import { useId } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';

import { cn } from '@/lib/utils';

/**
 * The Daily target presets as selectable cards. Native radios sharing one
 * name, so the group is operable by keyboard and announced as a radio group
 * with no extra wiring. Only the four presets are expressible: there is no
 * custom, fractional or hour-based input.
 */
export function DailyTargetPicker({
  registration,
}: {
  registration: UseFormRegisterReturn<'dailyPracticeTargetSeconds'>;
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
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {DAILY_PRACTICE_TARGET_SECONDS.map((seconds) => {
          const minutes = seconds / 60;
          return (
            <label key={seconds} className="relative cursor-pointer">
              <input
                type="radio"
                value={seconds}
                className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0"
                {...registration}
              />
              <span
                className={cn(
                  'flex items-center justify-center rounded-2xl bg-card px-4 py-5 text-center shadow-sm transition hover:shadow-md',
                  'font-bold text-lg tabular-nums',
                  'peer-checked:text-primary peer-checked:ring-2 peer-checked:ring-primary',
                  'peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background',
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
