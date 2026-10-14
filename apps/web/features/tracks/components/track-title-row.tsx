import type { TrackContributor, TrackDetail } from '@notefinder/contracts';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Fragment } from 'react';

import { Link } from '@/lib/i18n/navigation';

import { clockMessage } from '../playback/clock-message';
import { ContributorAvatar } from './contributor-avatar';
import { TrackCoverPlaceholder } from './track-cover-placeholder';
import { TrackFavoriteButton } from './track-favorite-button';
import { TrackShareDialog } from './track-share-dialog';

const LINK_CLASS =
  'rounded-sm outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50';

const AVATAR_CLASS = 'size-8 ring-2 ring-background';

/** The credit, each name linked to its Artist page when it has one. */
function ArtistCredit({ credit }: { credit: TrackDetail['artistCredit'] }) {
  return (
    <>
      {credit.map((entry, index) => (
        // A credit is a fixed ordered list, and one name can appear twice.
        // biome-ignore lint/suspicious/noArrayIndexKey: position is the identity.
        <Fragment key={index}>
          {entry.artistId === null ? (
            entry.name
          ) : (
            <Link href={`/artists/${entry.artistId}`} className={LINK_CLASS}>
              {entry.name}
            </Link>
          )}
          {entry.joinPhrase}
        </Fragment>
      ))}
    </>
  );
}

function Contributors({
  contributors,
}: {
  contributors: readonly TrackContributor[];
}) {
  const t = useTranslations('tracks.practice');

  return (
    <ul aria-label={t('contributors')} className="flex shrink-0 -space-x-2">
      {contributors.map((contributor) => (
        <li key={contributor.id}>
          {contributor.username === null ? (
            <span
              title={contributor.name}
              role="img"
              aria-label={contributor.name}
            >
              <ContributorAvatar
                contributor={contributor}
                className={AVATAR_CLASS}
              />
            </span>
          ) : (
            <Link
              href={`/users/${contributor.username}`}
              aria-label={t('contributorLink', { name: contributor.name })}
              title={contributor.name}
              className="block rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <ContributorAvatar
                contributor={contributor}
                className={AVATAR_CLASS}
              />
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}

/** The length as a clock (`3:08`), with hours past an hour. */
function Duration({ ms }: { ms: number }) {
  const t = useTranslations('tracks.practice');
  const { key, values: parts } = clockMessage(ms / 1000);
  const text = t(key, parts);

  return (
    <>
      <span className="sr-only">{t('durationLabel', { duration: text })}</span>
      <time
        aria-hidden="true"
        className="shrink-0 font-mono tabular-nums"
        dateTime={`PT${parts.hours}H${parts.minutes}M${parts.seconds}S`}
      >
        {text}
      </time>
    </>
  );
}

/**
 * The practice page's one-line title row: cover, title, artists (linked),
 * duration and the Contributors' avatars (linked to their Profiles). It wraps
 * on a phone, the avatars dropping under the title, and stays a single row
 * from `sm`.
 */
export function TrackTitleRow({ header }: { header: TrackDetail }) {
  const t = useTranslations('tracks.practice');

  return (
    <section
      aria-labelledby="track-title"
      className="flex flex-wrap items-center gap-x-4 gap-y-3"
    >
      <span className="relative block size-14 shrink-0 overflow-hidden rounded-xl bg-muted shadow-xs sm:size-16">
        {header.coverUrl ? (
          <Image
            src={header.coverUrl}
            alt=""
            fill
            unoptimized
            sizes="64px"
            className="object-cover"
          />
        ) : (
          <TrackCoverPlaceholder seed={header.id} />
        )}
      </span>
      <div className="flex min-w-0 flex-1 basis-48 flex-col">
        <h1
          id="track-title"
          className="truncate font-bold text-xl tracking-tight sm:text-2xl"
        >
          {header.title}
        </h1>
        <p className="flex min-w-0 items-center gap-2 text-muted-foreground text-sm">
          <span className="truncate">
            <ArtistCredit credit={header.artistCredit} />
          </span>
          {header.durationMs === null ? null : (
            <>
              <span aria-hidden="true">·</span>
              <Duration ms={header.durationMs} />
              <span aria-hidden="true">·</span>
            </>
          )}
          <span>{t('viewCount', { count: header.viewCount ?? 0 })}</span>
        </p>
      </div>
      {header.contributors.length > 0 ? (
        <Contributors contributors={header.contributors} />
      ) : null}
      <TrackFavoriteButton trackId={header.id} />
      <TrackShareDialog trackId={header.id} title={header.title} />
    </section>
  );
}
