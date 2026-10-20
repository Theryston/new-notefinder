'use client';

import Image from 'next/image';
import { useState } from 'react';

import { TrackCoverPlaceholder } from './track-cover-placeholder';

/**
 * The art of a Recording, filling its positioned parent. Without art, or when
 * the art fails to load, the geometric placeholder stands in. `sizes` is the
 * rendered width of the art at each breakpoint, so the optimizer picks a
 * close size.
 */
export function TrackCoverArt({
  coverArtUrl,
  placeholderSeed,
  sizes,
  priority,
}: {
  coverArtUrl?: string | null;
  placeholderSeed: string;
  sizes: string;
  /** Loads the art eagerly; only for covers visible on first paint. */
  priority?: boolean;
}) {
  const [artFailed, setArtFailed] = useState(false);
  if (!coverArtUrl || artFailed) {
    return <TrackCoverPlaceholder seed={placeholderSeed} />;
  }
  return (
    <Image
      src={coverArtUrl}
      alt=""
      fill
      priority={priority}
      sizes={sizes}
      className="object-cover"
      onError={() => setArtFailed(true)}
    />
  );
}
