import type { TrackSummary } from '@notefinder/contracts';
import { Play } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';

import { Link } from '@/lib/i18n/navigation';

import { formatVocalRange } from '../format-vocal-range';
import { TrackCover } from './track-cover';

type TrackCardProps = {
  track: TrackSummary;
  eager?: boolean;
};

/**
 * The default track card (cover grid): square cover with the vocal range,
 * title and artists. The whole card is one link to the track: small links
 * on top of it (artists) would be cramped touch targets, and the track page
 * links its artists.
 */
export function TrackCard({ track, eager }: TrackCardProps) {
  const t = useTranslations('tracks.card');
  const format = useFormatter();
  const title = track.title ?? t('untitled');

  return (
    <article className="group relative flex min-w-0 flex-col gap-3 rounded-2xl p-2 transition-[background-color,transform] duration-250 ease-spring hover:-translate-y-0.5 hover:bg-accent has-focus-visible:bg-accent">
      <div className="relative aspect-square overflow-hidden rounded-xl bg-muted shadow-sm">
        <TrackCover thumbnails={track.thumbnails} eager={eager} />
        {track.vocalRange && (
          <span className="glass absolute top-2 left-2 rounded-full px-2 py-0.5 font-medium font-mono text-foreground text-xs">
            <span className="sr-only">{t('vocalRange')} </span>
            {formatVocalRange(track.vocalRange)}
          </span>
        )}
        <span
          aria-hidden="true"
          className="absolute right-2 bottom-2 flex size-10 translate-y-2 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 shadow-md transition-[opacity,transform] duration-250 ease-spring group-hover:translate-y-0 group-hover:opacity-100 group-has-focus-visible:translate-y-0 group-has-focus-visible:opacity-100"
        >
          <Play className="size-4 fill-current" />
        </span>
      </div>
      <div className="flex min-w-0 flex-col gap-0.5 px-1 pb-1">
        <h3 className="truncate font-semibold text-sm">
          <Link
            href={`/tracks/${track.id}`}
            className="outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
          >
            {title}
          </Link>
        </h3>
        <p className="truncate text-muted-foreground text-xs">
          {format.list(track.artists.map((artist) => artist.name))}
        </p>
      </div>
    </article>
  );
}
