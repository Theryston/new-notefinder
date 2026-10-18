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
}: {
  coverArtUrl?: string | null;
  placeholderSeed: string;
  sizes: string;
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
      sizes={sizes}
      className="object-cover"
      onError={() => setArtFailed(true)}
    />
  );
}
