'use client';

import type {
  ArtistTrack,
  ArtistTrackExternalLink,
  ArtistTrackRelease,
  ArtistTrackTag,
  ArtistTrackWork,
} from '@notefinder/contracts';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

function ReleaseCover({ release }: { release: ArtistTrackRelease }) {
  const t = useTranslations('artists');
  const [artFailed, setArtFailed] = useState(false);
  // Only Cover Art Archive URLs reach next/image (see `remotePatterns`):
  // anything else falls back to the initials visual instead of throwing.
  const coverUrl =
    release.coverArtUrl?.startsWith('https://coverartarchive.org/') === true
      ? release.coverArtUrl
      : undefined;
  if (!coverUrl || artFailed) {
    return (
      <span
        aria-hidden="true"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted font-bold text-muted-foreground"
      >
        {release.title.charAt(0).toUpperCase()}
      </span>
    );
  }
  return (
    <Image
      src={coverUrl}
      alt={t('tracks.details.coverAlt', { title: release.title })}
      width={40}
      height={40}
      sizes="40px"
      className="h-10 w-10 shrink-0 rounded-lg object-cover"
      onError={() => setArtFailed(true)}
    />
  );
}

function TrackReleases({ releases }: { releases: ArtistTrackRelease[] }) {
  const t = useTranslations('artists');
  return (
    <div>
      <h4 className="mb-2 font-semibold text-sm">
        {t('tracks.details.releases')}
      </h4>
      {releases.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {t('tracks.details.noReleases')}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {releases.map((release) => (
            <li key={release.mbid} className="flex items-center gap-3">
              <ReleaseCover release={release} />
              <span className="text-sm">
                <span className="font-medium">{release.title}</span>
                {release.year ? (
                  <span className="text-muted-foreground">
                    {' '}
                    ({release.year})
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TrackWorks({ works }: { works: ArtistTrackWork[] }) {
  const t = useTranslations('artists');
  return (
    <div>
      <h4 className="mb-2 font-semibold text-sm">
        {t('tracks.details.works')}
      </h4>
      {works.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {t('tracks.details.noWorks')}
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {works.map((work) => (
            <li key={work.mbid} className="text-sm">
              {work.title}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TrackTags({ tags }: { tags: ArtistTrackTag[] }) {
  const t = useTranslations('artists');
  return (
    <div>
      <h4 className="mb-2 font-semibold text-sm">{t('tracks.details.tags')}</h4>
      {tags.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {t('tracks.details.noTags')}
        </p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <li
              key={tag.name}
              className="rounded-full bg-muted px-2.5 py-0.5 text-xs"
            >
              {tag.name}
              <span className="text-muted-foreground"> ({tag.count})</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TrackLinks({ links }: { links: ArtistTrackExternalLink[] }) {
  const t = useTranslations('artists');
  return (
    <div>
      <h4 className="mb-2 font-semibold text-sm">
        {t('tracks.details.links')}
      </h4>
      {links.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {t('tracks.details.noLinks')}
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {links.map((link) => (
            <li key={link.url} className="text-sm">
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t('tracks.details.openExternal', {
                  linkType: link.linkType,
                })}
                className="underline-offset-4 hover:underline focus-visible:underline"
              >
                {link.linkType}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The deeper MusicBrainz sections of one track row, shown when its
 * expand control is open: releases, works, tags and external links in
 * separate organized sections. Missing sections render their translated
 * empty state, so the layout stays predictable.
 */
export function ArtistTrackDetails({ track }: { track: ArtistTrack }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <TrackReleases releases={track.releases ?? []} />
      <TrackWorks works={track.works ?? []} />
      <TrackTags tags={track.tags ?? []} />
      <TrackLinks links={track.externalLinks ?? []} />
    </div>
  );
}
