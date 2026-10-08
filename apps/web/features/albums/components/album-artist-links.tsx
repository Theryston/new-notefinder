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
  /** Between two artists, from the translations (e.g. ", "). */
  artistSeparator: string;
  /** The collapsed control, e.g. "and 2 more". */
  moreLabel: string;
  /** The expanded control. */
  lessLabel: string;
};

const ARTIST_LINK_CLASS =
  'rounded-sm font-semibold outline-none hover:underline focus-visible:ring-3 focus-visible:ring-primary-foreground/60';

const MORE_BUTTON_CLASS =
  'rounded-sm font-semibold text-primary-foreground/80 text-sm outline-none transition-colors hover:text-primary-foreground focus-visible:ring-3 focus-visible:ring-primary-foreground/60';

/** One credited artist as a link to its page, after a separator from the one before. */
function ArtistItem({
  artist,
  separator,
}: {
  artist: AlbumArtist;
  separator: string | null;
}) {
  return (
    <li className="text-sm">
      {separator === null ? null : (
        <span aria-hidden="true" className="text-primary-foreground/80">
          {separator}
        </span>
      )}
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
  artistSeparator,
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
          <ArtistItem
            key={artist.id}
            artist={artist}
            separator={index > 0 ? artistSeparator : null}
          />
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
