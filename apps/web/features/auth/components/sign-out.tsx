'use client';

import { useQueryClient } from '@tanstack/react-query';
import { LogOutIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useRouter } from '@/lib/i18n/navigation';

import { loadAuthClient } from '../auth-client';
import { authRequest } from '../auth-error';
import { authKeys } from '../query-keys';
import type { AuthHref } from '../redirect-to';

/** Signs out, forgets the cached session and goes to `destination`. */
export function useSignOut() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const signOut = async (destination: AuthHref | string) => {
    setPending(true);
    const { error } = await authRequest(() =>
      loadAuthClient().then((client) => client.signOut()),
    );
    setPending(false);
    if (error) return;
    queryClient.setQueryData(authKeys.session(), null);
    router.replace(destination);
  };

  return { signOut, pending };
}

/**
 * "Signed in as … · Sign out" under an onboarding step, so a user stuck on it
 * (e.g. with an email they can't reach) can always leave the account.
 */
export function SignedInAs({ email }: { email: string }) {
  const t = useTranslations('auth');
  const { signOut, pending } = useSignOut();

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-5 text-muted-foreground text-sm">
      <p className="min-w-0">
        {t.rich('session.signedInAs', {
          email: () => (
            <strong className="wrap-break-word font-semibold text-foreground">
              {email}
            </strong>
          ),
        })}
      </p>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending}
        aria-busy={pending}
        onClick={() => signOut('/')}
      >
        {pending ? <Spinner aria-label={t('loading')} /> : <LogOutIcon />}
        {t('session.signOut')}
      </Button>
    </div>
  );
}
