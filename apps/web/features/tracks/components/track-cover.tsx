import type { Thumbnail } from '@notefinder/contracts';
import { Music } from 'lucide-react';
import Image from 'next/image';

import { pickThumbnail } from '../pick-thumbnail';

// Twice the widest card (6 columns on desktop, 2 on a phone), for sharp
// covers on high-density screens.
const COVER_MIN_WIDTH = 400;

type TrackCoverProps = {
  thumbnails: Thumbnail[];
  /** Load now instead of lazily: the covers in the first rows. */
  eager?: boolean;
};

/**
 * A track's square cover art. Decorative (the title is next to it), so its
 * `alt` is empty. Not run through the image optimizer: covers come already
 * sized from YouTube or storage, on hosts the app doesn't control.
 */
export function TrackCover({ thumbnails, eager = false }: TrackCoverProps) {
  const cover = pickThumbnail(thumbnails, COVER_MIN_WIDTH);

  if (!cover) {
    return (
      <div className="flex size-full items-center justify-center bg-muted text-muted-foreground">
        <Music className="size-8" />
      </div>
    );
  }

  return (
    <Image
      src={cover.url}
      alt=""
      width={cover.width ?? COVER_MIN_WIDTH}
      height={cover.height ?? COVER_MIN_WIDTH}
      unoptimized
      loading={eager ? 'eager' : 'lazy'}
      className="size-full object-cover"
    />
  );
}
