'use client';

import { useQuery } from '@tanstack/react-query';
import { CheckIcon, XIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { FieldDescription } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

import { usernameAvailabilityOptions } from '../username-availability';

const DEBOUNCE_MS = 350;

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export type Availability = 'unknown' | 'checking' | 'available' | 'taken';

/** Whether `username` (already valid) is free, checked while typing. */
export function useUsernameAvailability(username: string): Availability {
  const debounced = useDebouncedValue(username, DEBOUNCE_MS);
  const query = useQuery(usernameAvailabilityOptions(debounced));

  if (debounced !== username || query.isFetching) return 'checking';
  if (query.data === true) return 'available';
  if (query.data === false) return 'taken';
  return 'unknown';
}

const ICONS = { available: CheckIcon, taken: XIcon } as const;

/** The hint under the username: rules, or the live availability. */
export function AvailabilityHint({
  username,
  availability,
}: {
  username: string;
  availability: Availability;
}) {
  const t = useTranslations('auth.fields.username');

  if (availability === 'unknown') {
    return <FieldDescription>{t('hint')}</FieldDescription>;
  }
  const Icon = availability === 'checking' ? Spinner : ICONS[availability];

  return (
    <FieldDescription
      aria-live="polite"
      className={cn(
        'flex items-center gap-1.5',
        availability === 'available' && 'text-success',
        availability === 'taken' && 'text-destructive',
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      {availability === 'checking'
        ? t('checking')
        : t(availability, { username: username.toLowerCase() })}
    </FieldDescription>
  );
}
