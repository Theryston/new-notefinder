'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { SessionUserBoundary } from '@/features/auth/components/session-user';
import { BestScorePill } from '@/features/practice/components/best-score-pill';
import { Link } from '@/lib/i18n/navigation';

import { trackUserStateQueryOptions } from '../track-user-state-query';

/**
 * What a finished run means for the account, drawn inside the result sheet:
 * a signed-in User sees their best saved score at the difficulty they sang,
 * and a visitor is invited to sign in (the run waits in the session and is
 * submitted after).
 */
export function TrackAttemptStatus({ trackId }: { trackId: string }) {
  return (
    <SessionUserBoundary
      render={(user, loading) => {
        if (loading) return null;
        if (!user) return <SignInInvite trackId={trackId} />;
        return <BestScoreState trackId={trackId} />;
      }}
    />
  );
}

function BestScoreState({ trackId }: { trackId: string }) {
  const state = useQuery(trackUserStateQueryOptions(trackId));
  if (state.data === undefined) return null;
  return <BestScorePill bestScores={state.data.bestScores} />;
}

function SignInInvite({ trackId }: { trackId: string }) {
  const t = useTranslations('practice.scoring');
  return (
    <p className="text-muted-foreground text-sm">
      <Link
        href={{
          pathname: '/sign-in',
          query: { redirectTo: `/tracks/${trackId}` },
        }}
        className="underline underline-offset-4"
      >
        {t('signInToSave')}
      </Link>
    </p>
  );
}
