'use client';

import { useTranslations } from 'next-intl';
import { type ComponentProps, useSyncExternalStore } from 'react';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

const noSubscription = () => () => {};

/** `false` in the prerendered HTML and until React hydrates the form. */
function useHydrated(): boolean {
  return useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
}

/**
 * The full-width primary action of an auth form, with a pending state.
 * Disabled until hydration: before that a submit would be a native GET that
 * puts the fields (the password included) in the URL. It keeps looking
 * enabled meanwhile, so the static page doesn't flash a disabled button.
 */
export function SubmitButton({
  pending,
  children,
  disabled,
  className,
  ...props
}: ComponentProps<typeof Button> & { pending: boolean }) {
  const t = useTranslations('auth');
  const hydrated = useHydrated();

  return (
    <Button
      type="submit"
      size="lg"
      className={cn('w-full', !hydrated && 'disabled:opacity-100', className)}
      disabled={!hydrated || pending || disabled}
      aria-busy={pending}
      {...props}
    >
      {pending && <Spinner aria-label={t('loading')} />}
      {children}
    </Button>
  );
}
