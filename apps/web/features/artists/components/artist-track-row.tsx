'use client';

import type { ArtistTrack } from '@notefinder/contracts';
import { ChevronDownIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Fragment, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Link } from '@/lib/i18n/navigation';

import { formatTrackDuration } from '../format-track-duration';
import { ArtistTrackDetails } from './artist-track-details';

function TrackArtists({ track }: { track: ArtistTrack }) {
  return <>{track.artists.map((artist) => artist.name).join(', ')}</>;
}

function TrackDuration({ track }: { track: ArtistTrack }) {
  const t = useTranslations('artists');
  if (track.lengthMs === null) {
    return <span>{t('tracks.unknownDuration')}</span>;
  }
  return <span>{formatTrackDuration(track.lengthMs)}</span>;
}

function TrackIsrcs({ track }: { track: ArtistTrack }) {
  const t = useTranslations('artists');
  if (track.isrcs.length === 0) {
    return <span>{t('tracks.noIsrcs')}</span>;
  }
  return <>{track.isrcs.join(', ')}</>;
}

function TrackGenres({ track }: { track: ArtistTrack }) {
  const t = useTranslations('artists');
  if (track.genres.length === 0) {
    return <span>{t('tracks.noGenres')}</span>;
  }
  return <>{track.genres.join(', ')}</>;
}

/**
 * The expand control of one track row: a real button (keyboard operable)
 * whose expanded state is announced through `aria-expanded` and, when
 * open, linked to its details row through `aria-controls`.
 */
function TrackExpandButton({
  trackId,
  trackTitle,
  expanded,
  onToggle,
}: {
  trackId: string;
  trackTitle: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations('artists');
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-expanded={expanded}
      aria-controls={expanded ? `track-details-${trackId}` : undefined}
      aria-label={
        expanded
          ? t('tracks.details.collapse', { title: trackTitle })
          : t('tracks.details.expand', { title: trackTitle })
      }
      onClick={onToggle}
      className="mr-2 align-middle"
    >
      <ChevronDownIcon
        aria-hidden="true"
        className={expanded ? 'rotate-180 transition-transform' : ''}
      />
    </Button>
  );
}

/**
 * One processed track as a table row: the core columns the singer scans
 * (title, artists, duration, ISRCs, genres) plus an expandable row with
 * the deeper MusicBrainz sections (releases, works, tags, links). The
 * title links to the future track page, which resolves when that slice
 * lands.
 */
export function ArtistTrackRow({ track }: { track: ArtistTrack }) {
  const t = useTranslations('artists');
  const [expanded, setExpanded] = useState(false);
  const detailsId = `track-details-${track.id}`;
  return (
    <Fragment>
      <tr className="border-border border-b last:border-0">
        <th scope="row" className="px-4 py-3 text-left font-semibold">
          <TrackExpandButton
            trackId={track.id}
            trackTitle={track.title}
            expanded={expanded}
            onToggle={() => setExpanded((open) => !open)}
          />
          <Link
            href={`/tracks/${track.id}`}
            className="underline-offset-4 hover:underline focus-visible:underline"
          >
            {track.title}
          </Link>
          {track.disambiguation ? (
            <span className="block font-normal text-muted-foreground text-xs">
              {track.disambiguation}
            </span>
          ) : null}
          {track.video ? (
            <span className="mt-1 inline-block rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground text-xs">
              {t('tracks.video')}
            </span>
          ) : null}
        </th>
        <td className="px-4 py-3">
          <TrackArtists track={track} />
        </td>
        <td className="px-4 py-3 tabular-nums">
          <TrackDuration track={track} />
        </td>
        <td className="px-4 py-3">
          <TrackIsrcs track={track} />
        </td>
        <td className="px-4 py-3">
          <TrackGenres track={track} />
        </td>
      </tr>
      {expanded ? (
        <tr id={detailsId} className="border-border border-b last:border-0">
          <td colSpan={5} className="bg-muted/30 px-4 py-4">
            <ArtistTrackDetails track={track} />
          </td>
        </tr>
      ) : null}
    </Fragment>
  );
}
