'use client';

import type { ArtistTrack } from '@notefinder/contracts';
import { useTranslations } from 'next-intl';

import { Link } from '@/lib/i18n/navigation';

import { formatTrackDuration } from '../format-track-duration';

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
 * One processed track as a table row: the core columns the singer scans
 * (title, artists, duration, ISRCs, genres). The title links to the
 * future track page, which resolves when that slice lands.
 */
export function ArtistTrackRow({ track }: { track: ArtistTrack }) {
  const t = useTranslations('artists');
  return (
    <tr className="border-border border-b last:border-0">
      <th scope="row" className="px-4 py-3 text-left font-semibold">
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
  );
}
