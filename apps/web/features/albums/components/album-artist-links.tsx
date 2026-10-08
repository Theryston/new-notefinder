'use client';

import type { AlbumArtist } from '@notefinder/contracts';
import { useId, useState } from 'react';

import { Link } from '@/lib/i18n/navigation';

export type AlbumArtistLinksProps = {
  /** The artists always listed, in credit order. */
  visible: AlbumArtist[];
  /** The artists behind the "and N more" control, in credit order. */
  hidden: AlbumArtist[];
  artistsLabel: string;
  /** The collapsed control, e.g. "and 2 more". */
  moreLabel: string;
  /** The expanded control. */
  lessLabel: string;
};

const ARTIST_LINK_CLASS =
  'rounded-sm font-semibold text-foreground outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50';

const MORE_BUTTON_CLASS =
  'rounded-sm font-semibold text-muted-foreground text-sm outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50';

/** One credited artist as a link to its page, comma-separated from the one before. */
function ArtistItem({
  artist,
  separated,
}: {
  artist: AlbumArtist;
  separated: boolean;
}) {
  return (
    <li className="text-sm">
      {separated ? (
        <span aria-hidden="true" className="text-muted-foreground">
          {', '}
        </span>
      ) : null}
      <Link href={`/artists/${artist.id}`} className={ARTIST_LINK_CLASS}>
        {artist.name}
      </Link>
    </li>
  );
}

/**
 * The album's artists in credit order: the first three as links, then an
 * "and N more" button that reveals the rest. The button is a real button
 * with `aria-expanded`, controlling the list, so keyboard and screen-reader
 * users get the same state as mouse users.
 */
export function AlbumArtistLinks({
  visible,
  hidden,
  artistsLabel,
  moreLabel,
  lessLabel,
}: AlbumArtistLinksProps) {
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  const shown = expanded ? [...visible, ...hidden] : visible;

  return (
    <div className="flex flex-wrap items-baseline gap-x-2">
      <ul id={listId} aria-label={artistsLabel} className="flex flex-wrap">
        {shown.map((artist, index) => (
          <ArtistItem key={artist.id} artist={artist} separated={index > 0} />
        ))}
      </ul>
      {hidden.length > 0 ? (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={listId}
          onClick={() => setExpanded((open) => !open)}
          className={MORE_BUTTON_CLASS}
        >
          {expanded ? lessLabel : moreLabel}
        </button>
      ) : null}
    </div>
  );
}
