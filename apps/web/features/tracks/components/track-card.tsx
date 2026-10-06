'use client';

import type { SearchResultItem } from '@notefinder/contracts';
import { PlayIcon } from 'lucide-react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Link } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils';

import { TrackCoverPlaceholder } from './track-cover-placeholder';

const PLAY_BADGE_CLASS =
  'absolute right-2 bottom-2 flex size-10 translate-y-1 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 shadow-xs transition-[opacity,transform] duration-500 ease-spring group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100 focus-visible:translate-y-0 focus-visible:opacity-100';

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
 * One search hit as a cover-grid card (Spotify): the primary release art
 * (or a deterministic geometric placeholder when there is none), the title
 * plus the artist credit, and a hover-only play affordance. The hover and
 * the play badge exist whether or not the Recording already has a
 * `trackId`: with one the whole card links to the Track page, without one
 * the card is static and only the play button focuses.
 */
export function TrackCard({ result }: { result: SearchResultItem }) {
  const t = useTranslations('search');
  const [artFailed, setArtFailed] = useState(false);
  const coverUrl = result.primaryRelease?.coverArtUrl;
  const showArt = coverUrl && !artFailed;
  const playLabel = t('card.play', { title: result.title });

  const cover = (
    <span className="relative block aspect-square h-auto w-full overflow-hidden rounded-xl bg-muted">
      {showArt ? (
        <Image
          src={coverUrl}
          alt=""
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 16vw, 12vw"
          className="object-cover"
          onError={() => setArtFailed(true)}
        />
      ) : (
        <TrackCoverPlaceholder seed={result.mbid} />
      )}
      {result.trackId ? (
        <span aria-hidden="true" className={PLAY_BADGE_CLASS}>
          <PlayIcon className="size-4 fill-current" />
        </span>
      ) : (
        <CoverPlay label={playLabel} />
      )}
    </span>
  );

  const text = (
    <span className="flex min-w-0 flex-col gap-0.5 px-1">
      <span className="truncate font-semibold text-sm">{result.title}</span>
      <span className="truncate font-medium text-muted-foreground text-xs">
        {result.artistCredit.name}
      </span>
    </span>
  );

  if (!result.trackId) {
    return (
      <div className="group flex flex-col gap-1.5 rounded-2xl p-2 outline-none transition-colors duration-150 ease-out hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50">
        {cover}
        {text}
      </div>
    );
  }

  return (
    <Link
      href={`/tracks/${result.trackId}`}
      className={cn(
        'group flex flex-col gap-1.5 rounded-2xl p-2 outline-none',
        'transition-colors duration-150 ease-out hover:bg-accent',
        'focus-visible:ring-3 focus-visible:ring-ring/50',
      )}
    >
      {cover}
      {text}
    </Link>
  );
}
