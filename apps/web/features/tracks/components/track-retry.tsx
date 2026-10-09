'use client';

import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { SessionUserBoundary } from '@/features/auth/components/session-user';
import { TextLink } from '@/features/auth/components/text-link';

import { useRetryTrack } from '../hooks/use-retry-track';
import { retrySignInPath } from '../retry-offer';

/**
 * "Try again" on a failed Processing a retry can pick up. A signed-in visitor
 * retries in place; a signed-out one goes to sign in and comes back to the
 * Track's page.
 */
export function TrackRetry({ trackId }: { trackId: string }) {
  return (
    <SessionUserBoundary
      render={(user) =>
        user === null ? (
          <SignInToRetry trackId={trackId} />
        ) : (
          <RetryButton trackId={trackId} />
        )
      }
    />
  );
}

function RetryButton({ trackId }: { trackId: string }) {
  const t = useTranslations('tracks.processing.retry');
  const retry = useRetryTrack(trackId);
  return (
    <Button
      type="button"
      disabled={retry.isPending}
      onClick={() => retry.mutate()}
    >
      {t('action')}
    </Button>
  );
}

function SignInToRetry({ trackId }: { trackId: string }) {
  const t = useTranslations('tracks.processing.retry');
  const href = {
    pathname: '/sign-in' as const,
    query: { redirectTo: retrySignInPath(trackId) },
  };
  return <TextLink href={href}>{t('signIn')}</TextLink>;
}
