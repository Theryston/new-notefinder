'use client';

import type { TrackVocalRange } from '@notefinder/contracts';
import { PlayIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { Spinner } from '@/components/ui/spinner';
import { Link } from '@/lib/i18n/navigation';
import { rangeBarGeometry, rangeName } from '@/lib/music-notes';
import { cn } from '@/lib/utils';

import type { RequestTrackState } from './request-track-action';
import { TrackCoverArt } from './track-cover-art';

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

const voiceFitMessageKey = (fitsVoice: boolean | undefined) =>
  fitsVoice === undefined
    ? undefined
    : fitsVoice
      ? 'card.fitsVoice'
      : 'card.transposeVoice';

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
  /** Overrides the grid's cover `sizes` (e.g. a carousel's fixed widths). */
  coverSizes?: string;
  /** Loads the cover eagerly; only for cards visible on first paint. */
  coverPriority?: boolean;
  /**
   * The Track's stored Vocal range: shows the range chip on the cover. Home
   * rows pass it; search and grids leave it out.
   */
  vocalRange?: TrackVocalRange | null;
  /**
   * Draws the range as a bar over the cover (the vocal-range rows). Only
   * applies with `vocalRange`; the chip stays the accessible text.
   */
  rangeBar?: boolean;
  /** Whether the card's vocal range fits the User without transposition. */
  fitsVoice?: boolean;
  /** Makes a card without a Track an action; without it the card stays static. */
  request?: RequestTrackState;
  /** Makes a card without a Track a link to sign in first. */
  signIn?: TrackCardSignIn;
  /** Uses a browser-native link, for home clicks that update the destination. */
  nativeTrackLink?: boolean;
};

/**
 * The square cover: the art, or the geometric placeholder when there is none
 * or it fails to load, with the card's badge over its bottom-right corner.
 */
const GRID_COVER_SIZES =
  '(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 16vw, 12vw';

function TrackCardCover({
  coverArtUrl,
  placeholderSeed,
  badge,
  coverSizes,
  coverPriority,
  vocalRange,
  rangeBar,
  fitsVoiceLabel,
}: {
  coverArtUrl?: string | null;
  placeholderSeed: string;
  badge: ReactNode;
  coverSizes?: string;
  coverPriority?: boolean;
  vocalRange?: TrackVocalRange | null;
  rangeBar?: boolean;
  fitsVoiceLabel?: string;
}) {
  return (
    <span className="relative block aspect-square h-auto w-full overflow-hidden rounded-xl bg-muted">
      <TrackCoverArt
        coverArtUrl={coverArtUrl}
        placeholderSeed={placeholderSeed}
        sizes={coverSizes ?? GRID_COVER_SIZES}
        priority={coverPriority}
      />
      {vocalRange && rangeBar ? (
        <VocalRangeBar
          lowest={vocalRange.lowest}
          highest={vocalRange.highest}
        />
      ) : null}
      {vocalRange ? (
        <span className="glass absolute bottom-2 left-2 rounded-full px-2.5 py-1 font-semibold text-xs tabular-nums">
          {rangeName(vocalRange.lowest, vocalRange.highest)}
        </span>
      ) : null}
      {fitsVoiceLabel ? (
        <span className="glass absolute top-7 right-2 rounded-full px-2 py-1 font-semibold text-[0.625rem]">
          {fitsVoiceLabel}
        </span>
      ) : null}
      {badge}
    </span>
  );
}

/**
 * The Track's range as a small bar over the cover's top edge: white on a
 * dimmed track, so it reads over any art in both themes. The chip next to it
 * carries the same range as text, so the bar is hidden from assistive tech.
 */
function VocalRangeBar({
  lowest,
  highest,
}: {
  lowest: number;
  highest: number;
}) {
  const { leftPercent, widthPercent } = rangeBarGeometry(lowest, highest);
  return (
    <span
      aria-hidden="true"
      className="absolute inset-x-2 top-2 h-1 overflow-hidden rounded-full bg-black/45"
    >
      <span
        className="block h-full min-w-0.5 rounded-full bg-white/95"
        style={{
          marginLeft: `${leftPercent}%`,
          width: `${widthPercent}%`,
        }}
      />
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

function TrackCardTrackLinkContent({
  cover,
  text,
}: {
  cover: (badge: ReactNode) => ReactNode;
  text: ReactNode;
}) {
  return (
    <>
      {cover(
        <span aria-hidden="true" className={PLAY_BADGE_CLASS}>
          <PlayIcon className="size-4 fill-current" />
        </span>,
      )}
      {text}
    </>
  );
}

function TrackCardTrackLink({
  trackId,
  locale,
  native,
  children,
}: {
  trackId: string;
  locale: string;
  native: boolean;
  children: ReactNode;
}) {
  if (native) {
    return (
      <a href={`/${locale}/tracks/${trackId}`} className={CARD_CLASS}>
        {children}
      </a>
    );
  }
  return (
    <Link href={`/tracks/${trackId}`} className={CARD_CLASS}>
      {children}
    </Link>
  );
}

type TrackCardCopy = {
  play: string;
  signInLabel: string;
  generateLabel: string;
  generate: string;
  generating: string;
};

function TrackCardFallback({
  request,
  signIn,
  cover,
  text,
  copy,
}: {
  request: RequestTrackState | undefined;
  signIn: TrackCardSignIn | undefined;
  cover: (badge: ReactNode) => ReactNode;
  text: ReactNode;
  copy: TrackCardCopy;
}) {
  if (signIn) {
    return (
      <Link
        href={signIn.href}
        aria-label={copy.signInLabel}
        className={REQUEST_CARD_CLASS}
      >
        {cover(<RequestBadge pending={false} hint={copy.generate} />)}
        {text}
      </Link>
    );
  }
  if (request) {
    return (
      <button
        type="button"
        aria-busy={request.pending}
        aria-label={copy.generateLabel}
        disabled={request.pending}
        onClick={request.onRequest}
        className={REQUEST_CARD_CLASS}
      >
        {cover(
          <RequestBadge
            pending={request.pending}
            hint={request.pending ? copy.generating : copy.generate}
          />,
        )}
        {text}
      </button>
    );
  }
  return (
    <div className={CARD_CLASS}>
      {cover(<CoverPlay label={copy.play} />)}
      {text}
    </div>
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
  const locale = useLocale();
  const t = useTranslations('tracks');
  const voiceFitKey = voiceFitMessageKey(props.fitsVoice);
  const fitsVoiceLabel = voiceFitKey ? t(voiceFitKey) : undefined;
  const cover = (badge: ReactNode) => (
    <TrackCardCover
      coverArtUrl={props.coverArtUrl}
      placeholderSeed={props.placeholderSeed}
      coverSizes={props.coverSizes}
      coverPriority={props.coverPriority}
      vocalRange={props.vocalRange}
      rangeBar={props.rangeBar}
      fitsVoiceLabel={fitsVoiceLabel}
      badge={badge}
    />
  );
  const text = <TrackCardText title={title} subtitle={subtitle} />;

  if (trackId)
    return (
      <TrackCardTrackLink
        trackId={trackId}
        locale={locale}
        native={props.nativeTrackLink ?? false}
      >
        <TrackCardTrackLinkContent cover={cover} text={text} />
      </TrackCardTrackLink>
    );
  return (
    <TrackCardFallback
      request={request}
      signIn={signIn}
      cover={cover}
      text={text}
      copy={{
        play: t('card.play', { title }),
        signInLabel: t('card.signInLabel', { title }),
        generateLabel: t('card.generateLabel', { title }),
        generate: t('card.generate'),
        generating: t('card.generating'),
      }}
    />
  );
}
