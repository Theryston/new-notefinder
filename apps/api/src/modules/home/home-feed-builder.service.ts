import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type {
  HomeRow,
  HomeRowTitle,
  HomeTrack,
  Locale,
} from '@notefinder/contracts';
import { type StoredHomeFeed } from './home-feed.js';
import { composeHomeRows } from './home-feed-composer.js';
import {
  HOME_ROW_SOURCES,
  type HomeCandidate,
  type HomeRowSource,
} from './home-row-sources.js';
import {
  DEFAULT_HOME_LOCALE,
  HOME_ALGORITHM_VERSION,
  type HomeLayout,
} from './home-rules.js';

type ComposedRow = {
  id: string;
  layout: HomeLayout;
  title: HomeRowTitle | undefined;
  items: HomeCandidate[];
};

export const toHomeTrack = (candidate: HomeCandidate): HomeTrack => ({
  id: candidate.id,
  title: candidate.title,
  coverUrl: candidate.coverUrl,
  // Only the public name and join phrase: the artist MBID stays server-side.
  artistCredit: candidate.artistCredit.map(({ name, joinPhrase }) => ({
    name,
    joinPhrase,
  })),
  durationMs: candidate.durationMs,
  vocalRange: candidate.vocalRange,
});

const toHomeRow = (row: ComposedRow): HomeRow | undefined => {
  if (row.layout === 'hero') {
    const [track] = row.items;
    return track
      ? { id: row.id, layout: 'hero', track: toHomeTrack(track) }
      : undefined;
  }
  return row.title
    ? {
        id: row.id,
        layout: 'standard',
        title: row.title,
        items: row.items.map(toHomeTrack),
      }
    : undefined;
};

/**
 * The version of a feed is a hash of its locale, its content and the algorithm
 * that made it: an unchanged feed keeps its version, so its cursors stay valid
 * and the web is not revalidated for nothing. The locale is in the hash, so
 * the version alone names one locale's feed.
 */
const feedVersion = (locale: Locale, rows: HomeRow[]): string =>
  createHash('sha256')
    .update(
      JSON.stringify({
        algorithmVersion: HOME_ALGORITHM_VERSION,
        locale,
        rows,
      }),
    )
    .digest('hex')
    .slice(0, 16);

/** Loads one locale's candidate rows, composes them and returns its public feed. */
@Injectable()
export class HomeFeedBuilder {
  constructor(
    @Inject(HOME_ROW_SOURCES) private readonly sources: HomeRowSource[],
  ) {}

  async build(locale: Locale = DEFAULT_HOME_LOCALE): Promise<StoredHomeFeed> {
    const candidates = await Promise.all(
      this.sources.map(async (source) => ({
        id: source.id,
        layout: source.layout,
        title: source.title,
        items: await source.load(locale),
      })),
    );
    const rows = composeHomeRows(candidates)
      .map(toHomeRow)
      .filter((row): row is HomeRow => row !== undefined);
    return {
      audience: 'public',
      locale,
      version: feedVersion(locale, rows),
      algorithmVersion: HOME_ALGORITHM_VERSION,
      rows,
    };
  }
}
