'use client';

import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

import { type PasswordStrength, passwordStrength } from '../password-strength';

const LEVELS = {
  1: { label: 'weak', color: 'bg-destructive' },
  2: { label: 'fair', color: 'bg-warning' },
  3: { label: 'strong', color: 'bg-success' },
} as const;

const SEGMENTS = [1, 2, 3] as const;

/** A three-segment hint under the password; hidden until it's long enough. */
export function PasswordStrengthMeter({ password }: { password: string }) {
  const t = useTranslations('auth.fields.password.strength');
  const strength: PasswordStrength = passwordStrength(password);
  const level = strength === 0 ? undefined : LEVELS[strength];

  return (
    <div
      className={cn(
        'flex items-center gap-3 transition-opacity duration-150 ease-out',
        level ? 'opacity-100' : 'opacity-0',
      )}
      aria-hidden={level === undefined}
    >
      <div className="flex flex-1 gap-1">
        {SEGMENTS.map((segment) => (
          <span
            key={segment}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors duration-200',
              level && segment <= strength ? level.color : 'bg-muted',
            )}
          />
        ))}
      </div>
      <p
        aria-live="polite"
        className="min-w-16 text-right font-medium text-muted-foreground text-xs"
      >
        {level && (
          <>
            <span className="sr-only">
              {t('label', { level: t(level.label) })}
            </span>
            <span aria-hidden="true">{t(level.label)}</span>
          </>
        )}
      </p>
    </div>
  );
}
