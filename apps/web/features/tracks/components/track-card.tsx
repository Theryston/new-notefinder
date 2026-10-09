'use client';

import { PlayIcon } from 'lucide-react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { type ReactNode, useState } from 'react';
import { Spinner } from '@/components/ui/spinner';
import { Link } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils';

import { TrackCoverPlaceholder } from './track-cover-placeholder';

const PLAY_BADGE_CLASS =
  'absolute right-2 bottom-2 flex size-10 translate-y-1 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 shadow-xs transition-[opacity,transform] duration-500 ease-spring group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100 focus-visible:translate-y-0 focus-visible:opacity-100';

const REQUEST_HINT_CLASS =
  'glass absolute bottom-2 left-2 rounded-full px-2.5 py-1 font-semibold text-xs transition-opacity duration-150 ease-out';

/** The surface every card shares: a rounded hover tint and a focus ring. */
const CARD_CLASS =
  'group flex flex-col gap-1.5 rounded-2xl p-2 outline-none transition-colors duration-150 ease-out hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50';

const REQUEST_CARD_CLASS = cn(
  CARD_CLASS,
  'w-full text-left disabled:cursor-progress',
);

function CoverPlay({ label }: { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      tabIndex={0}
      className={PLAY_BADGE_CLASS}
    >
      <PlayIcon className="size-4 fill-current" />
    </button>
  );
}

/**
 * The "generate notes" affordance of a card without a Track: a hint chip that
 * shows on hover and focus, and the round badge, which turns into a spinner
 * while the request is on its way (the hint then stays visible).
 */
function RequestBadge({ pending, hint }: { pending: boolean; hint: string }) {
  return (
    <>
      <span
        aria-hidden="true"
        className={cn(
          REQUEST_HINT_CLASS,
          pending
            ? 'opacity-100'
            : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100',
        )}
      >
        {hint}
      </span>
      <span
        aria-hidden="true"
        className={cn(PLAY_BADGE_CLASS, pending && 'translate-y-0 opacity-100')}
      >
        {pending ? (
          <Spinner className="size-4" />
        ) : (
          <PlayIcon className="size-4 fill-current" />
        )}
      </span>
    </>
  );
}

/** Offers "generate notes" on a card without a Track, for one Recording. */
type TrackCardRequest = {
  /** The request for this card's Track is on its way. */
  pending: boolean;
  onRequest: () => void;
};

/** The sign-in page, with `redirectTo` back to the search and its request marker. */
export type SignInHref = {
  pathname: '/sign-in';
  query: Record<string, string>;
};

/** Sends a signed-out visitor who clicks a card without a Track to sign in. */
type TrackCardSignIn = { href: SignInHref };

export type TrackCardProps = {
  trackId: string | null;
  title: string;
  subtitle: string;
  coverArtUrl?: string | null;
  placeholderSeed: string;
  /** Makes a card without a Track an action; without it the card stays static. */
  request?: TrackCardRequest;
  /** Makes a card without a Track a link to sign in first. */
  signIn?: TrackCardSignIn;
};

/**
 * The square cover: the art, or the geometric placeholder when there is none
 * or it fails to load, with the card's badge over its bottom-right corner.
 */
function TrackCardCover({
  coverArtUrl,
  placeholderSeed,
  badge,
}: {
  coverArtUrl?: string | null;
  placeholderSeed: string;
  badge: ReactNode;
}) {
  const [artFailed, setArtFailed] = useState(false);
  const showArt = coverArtUrl && !artFailed;

  return (
    <span className="relative block aspect-square h-auto w-full overflow-hidden rounded-xl bg-muted">
      {showArt ? (
        <Image
          src={coverArtUrl}
          alt=""
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 16vw, 12vw"
          className="object-cover"
          onError={() => setArtFailed(true)}
        />
      ) : (
        <TrackCoverPlaceholder seed={placeholderSeed} />
      )}
      {badge}
    </span>
  );
}

function TrackCardText({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <span className="flex min-w-0 flex-col gap-0.5 px-1">
      <span className="truncate font-semibold text-sm">{title}</span>
      <span className="truncate font-medium text-muted-foreground text-xs">
        {subtitle}
      </span>
    </span>
  );
}

/**
 * One track as a cover-grid card (Spotify): the cover art (or a
 * deterministic geometric placeholder when there is none), the title plus
 * the subtitle, and a hover-only play affordance. The hover and the play
 * badge exist whether or not the card already has a `trackId`: with one
 * the whole card links to the Track page. Without one, a card with a
 * `request` is a button that asks for the Track ("generate notes"), a card
 * with `signIn` is a link to sign in first, and a card with neither is static
 * and only the play button focuses.
 */
export function TrackCard(props: TrackCardProps) {
  const { trackId, title, subtitle, request, signIn } = props;
  const t = useTranslations('tracks');
  const cover = (badge: ReactNode) => (
    <TrackCardCover
      coverArtUrl={props.coverArtUrl}
      placeholderSeed={props.placeholderSeed}
      badge={badge}
    />
  );
  const text = <TrackCardText title={title} subtitle={subtitle} />;

  if (trackId) {
    return (
      <Link href={`/tracks/${trackId}`} className={CARD_CLASS}>
        {cover(
          <span aria-hidden="true" className={PLAY_BADGE_CLASS}>
            <PlayIcon className="size-4 fill-current" />
          </span>,
        )}
        {text}
      </Link>
    );
  }

  if (signIn) {
    return (
      <Link
        href={signIn.href}
        aria-label={t('card.signInLabel', { title })}
        className={REQUEST_CARD_CLASS}
      >
        {cover(<RequestBadge pending={false} hint={t('card.generate')} />)}
        {text}
      </Link>
    );
  }

  if (request) {
    return (
      <button
        type="button"
        aria-busy={request.pending}
        aria-label={t('card.generateLabel', { title })}
        disabled={request.pending}
        onClick={request.onRequest}
        className={REQUEST_CARD_CLASS}
      >
        {cover(
          <RequestBadge
            pending={request.pending}
            hint={request.pending ? t('card.generating') : t('card.generate')}
          />,
        )}
        {text}
      </button>
    );
  }

  return (
    <div className={CARD_CLASS}>
      {cover(<CoverPlay label={t('card.play', { title })} />)}
      {text}
    </div>
  );
}
