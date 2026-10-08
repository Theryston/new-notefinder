import type { TrackHeader } from '@notefinder/contracts';
import Image from 'next/image';
import { useTranslations } from 'next-intl';

import {
  entityBannerClass,
  entityBannerRowClass,
  entityInfoClass,
  entityTitleClass,
  entityVisualClass,
} from '@/components/entity-header';
import { Link } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils';

import { TrackCoverPlaceholder } from './track-cover-placeholder';

/**
 * The Track's cover: the stored one once a Processing has found it, else the
 * geometric placeholder keyed by the Track, so it never changes between
 * renders.
 */
function TrackHeaderCover({ track }: { track: TrackHeader }) {
  return (
    <span
      className={cn(
        entityVisualClass,
        'relative block aspect-square overflow-hidden rounded-xl shadow-xl',
      )}
    >
      {track.coverUrl ? (
        <Image
          src={track.coverUrl}
          alt=""
          fill
          unoptimized
          sizes="(max-width: 640px) 96px, (max-width: 768px) 128px, 192px"
          className="object-cover"
        />
      ) : (
        <TrackCoverPlaceholder seed={track.id} />
      )}
    </span>
  );
}

/**
 * The Track banner of the Processing page, a featured block like the artist
 * and album headers: the cover, the title and the linked Artists. The Artists
 * are empty until the metadata import has run.
 */
export function TrackProcessingHeader({ track }: { track: TrackHeader }) {
  const t = useTranslations('tracks.processing');

  return (
    <section aria-labelledby="track-title" className={entityBannerClass}>
      <div className={entityBannerRowClass}>
        <TrackHeaderCover track={track} />
        <div className="flex min-w-0 flex-col gap-3 sm:flex-1">
          <h1 id="track-title" className={entityTitleClass}>
            {track.title}
          </h1>
          {track.artists.length > 0 ? (
            <ul
              aria-label={t('artists')}
              className={cn(entityInfoClass, 'flex flex-wrap gap-x-3')}
            >
              {track.artists.map((artist) => (
                <li key={artist.id}>
                  <Link
                    href={`/artists/${artist.id}`}
                    className="underline-offset-4 hover:underline"
                  >
                    {artist.name}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </section>
  );
}
