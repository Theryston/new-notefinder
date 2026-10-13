'use client';

import { useQuery } from '@tanstack/react-query';
import { HeartIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SessionUserBoundary } from '@/features/auth/components/session-user';
import { Link } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils';

import { useTrackFavorite } from '../hooks/use-track-favorite';
import { trackUserStateQueryOptions } from '../track-user-state-query';

const BUTTON_CLASS = 'shrink-0';

/** A visitor's heart: sign in, then come back to this Track. */
function SignInHeart({ trackId }: { trackId: string }) {
  const t = useTranslations('tracks.practice.favorite');

  return (
    <Link
      href={{
        pathname: '/sign-in',
        query: { redirectTo: `/tracks/${trackId}` },
      }}
      aria-label={t('signIn')}
      title={t('signIn')}
      className={cn(
        buttonVariants({ variant: 'secondary', size: 'icon' }),
        BUTTON_CLASS,
      )}
    >
      <HeartIcon aria-hidden="true" />
    </Link>
  );
}

/** The signed-in User's heart: it flips at once and flips back on a failure. */
function FavoriteHeart({ trackId }: { trackId: string }) {
  const t = useTranslations('tracks.practice.favorite');
  const state = useQuery(trackUserStateQueryOptions(trackId));
  const favorite = useTrackFavorite(trackId);
  // The pop plays on a tap, not when a page opens on a favorite.
  const [popped, setPopped] = useState(false);
  const isFavorite = state.data?.isFavorite === true;
  const label = isFavorite ? t('remove') : t('add');

  return (
    <Button
      type="button"
      variant="secondary"
      size="icon"
      aria-label={label}
      aria-pressed={isFavorite}
      title={label}
      // Until the state is known the heart cannot say what a tap would do. If
      // the read failed it stays usable as "not a favorite": both writes are
      // idempotent, so a wrong guess costs nothing.
      disabled={
        (state.data === undefined && !state.isError) || favorite.isPending
      }
      className={BUTTON_CLASS}
      onClick={() => {
        setPopped(true);
        favorite.mutate(!isFavorite);
      }}
    >
      <HeartIcon
        aria-hidden="true"
        className={cn(
          isFavorite && 'fill-primary text-primary',
          isFavorite && popped && 'animate-pop',
        )}
      />
    </Button>
  );
}

/**
 * The heart of the title row. The state is session-dependent, so it is read
 * in the browser while the page itself stays cached: the space is kept while
 * the session loads, a signed-in User gets the toggle and a visitor a link to
 * sign in.
 */
export function TrackFavoriteButton({ trackId }: { trackId: string }) {
  return (
    <SessionUserBoundary
      render={(user, loading) => {
        if (user) return <FavoriteHeart trackId={trackId} />;
        if (loading)
          return <Skeleton className="size-10 shrink-0 rounded-full" />;
        return <SignInHeart trackId={trackId} />;
      }}
    />
  );
}
