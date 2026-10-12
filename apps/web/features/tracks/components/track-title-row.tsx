import type {
  TrackContributor,
  TrackPracticeHeader,
} from '@notefinder/contracts';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Fragment } from 'react';

import { UserAvatar } from '@/features/auth/components/user-avatar';
import { Link } from '@/lib/i18n/navigation';

import { formatDuration } from '../format-duration';
import { TrackCoverPlaceholder } from './track-cover-placeholder';

const LINK_CLASS =
  'rounded-sm outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50';

/** The credit, each name linked to its Artist page when it has one. */
function ArtistCredit({
  credit,
}: {
  credit: TrackPracticeHeader['artistCredit'];
}) {
  return (
    <>
      {credit.map((entry) => (
        <Fragment key={entry.name}>
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
              <ContributorAvatar contributor={contributor} />
            </span>
          ) : (
            <Link
              href={`/users/${contributor.username}`}
              aria-label={t('contributorLink', { name: contributor.name })}
              title={contributor.name}
              className="block rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <ContributorAvatar contributor={contributor} />
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}

function ContributorAvatar({ contributor }: { contributor: TrackContributor }) {
  return (
    <UserAvatar
      user={{
        name: contributor.name,
        username: contributor.username,
        // The session type leaves a missing photo out rather than null.
        image: contributor.image ?? undefined,
      }}
      className="size-8 ring-2 ring-background"
    />
  );
}

/**
 * The practice page's one-line title row: cover, title, artists (linked),
 * duration and the Contributors' avatars (linked to their Profiles). It wraps
 * on a phone, the avatars dropping under the title, and stays a single row
 * from `sm`.
 */
export function TrackTitleRow({ header }: { header: TrackPracticeHeader }) {
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
              <span className="shrink-0">
                <span className="sr-only">{t('duration')}: </span>
                <time
                  className="font-mono tabular-nums"
                  dateTime={`PT${Math.round(header.durationMs / 1000)}S`}
                >
                  {formatDuration(header.durationMs)}
                </time>
              </span>
            </>
          )}
        </p>
      </div>
      {header.contributors.length > 0 ? (
        <Contributors contributors={header.contributors} />
      ) : null}
    </section>
  );
}
