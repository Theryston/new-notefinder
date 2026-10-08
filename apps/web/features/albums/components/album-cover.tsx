'use client';

import Image from 'next/image';
import { useState } from 'react';

import { TrackCoverPlaceholder } from '@/features/tracks/components/track-cover-placeholder';

/**
 * The album's square cover. When there is no cover, or the art fails to
 * load, the same geometric placeholder the track cards use stands in, keyed
 * by the album ID so an album always gets the same one. The title beside it
 * names the album, so the image is decorative (`alt=""`).
 */
export function AlbumCover({
  albumId,
  coverArtUrl,
}: {
  albumId: string;
  coverArtUrl: string | null;
}) {
  const [artFailed, setArtFailed] = useState(false);
  const artUrl = artFailed ? null : coverArtUrl;

  return (
    <span className="relative block aspect-square size-24 shrink-0 overflow-hidden rounded-xl bg-muted shadow-sm sm:size-32 md:size-40">
      {artUrl ? (
        <Image
          src={artUrl}
          alt=""
          fill
          sizes="(max-width: 640px) 96px, (max-width: 768px) 128px, 160px"
          className="object-cover"
          onError={() => setArtFailed(true)}
        />
      ) : (
        <TrackCoverPlaceholder seed={albumId} />
      )}
    </span>
  );
}
