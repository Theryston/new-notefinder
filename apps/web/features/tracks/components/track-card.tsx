'use client';

import type { SearchResultItem } from '@notefinder/contracts';
import { MusicIcon, PlayIcon } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { Link } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils';

import { coverFallbackStyle } from '../track-cover';

/**
 * One search hit as a cover-grid card (Spotify): the primary release art
 * (or a deterministic gradient when there is none), the title plus the
 * artist credit, and a hover-only play affordance with no playback behind
 * it. When notefinder already processed the Recording (`trackId`), the
 * whole card links to the Track page; otherwise it is a static card with
 * no hover or play action.
 */
export function TrackCard({ result }: { result: SearchResultItem }) {
  const [artFailed, setArtFailed] = useState(false);
  const coverUrl = result.primaryRelease?.coverArtUrl;
  const showArt = coverUrl && !artFailed;

  const cover = (
    <span
      className="relative block aspect-square w-full overflow-hidden rounded-xl bg-muted"
      style={showArt ? undefined : coverFallbackStyle(result.mbid)}
    >
      {showArt ? (
        <Image
          src={coverUrl}
          alt=""
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          className="object-cover"
          onError={() => setArtFailed(true)}
        />
      ) : (
        <MusicIcon
          aria-hidden="true"
          className="absolute inset-0 m-auto size-10 text-white/80"
        />
      )}
      {result.trackId ? (
        <span
          aria-hidden="true"
          className="absolute right-2 bottom-2 flex size-10 translate-y-1 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 shadow-md transition-[opacity,transform] duration-250 ease-spring group-hover:translate-y-0 group-hover:opacity-100"
        >
          <PlayIcon className="size-4 fill-current" />
        </span>
      ) : null}
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
      <div className="flex flex-col gap-2 rounded-2xl p-3">
        {cover}
        {text}
      </div>
    );
  }

  return (
    <Link
      href={`/tracks/${result.trackId}`}
      className={cn(
        'group flex flex-col gap-2 rounded-2xl p-3 outline-none',
        'transition-colors duration-150 ease-out hover:bg-accent',
        'focus-visible:ring-3 focus-visible:ring-ring/50',
      )}
    >
      {cover}
      {text}
    </Link>
  );
}
