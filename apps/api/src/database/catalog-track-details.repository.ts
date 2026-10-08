import type {
  CatalogTrack,
  CatalogTrackExternalLink,
  CatalogTrackRelease,
  CatalogTrackTag,
  CatalogTrackWork,
} from '@notefinder/contracts';
import { asc, desc, eq, inArray } from 'drizzle-orm';
import type { Database } from './database.js';
import { artists, trackArtists } from './schema/artists.js';
import {
  trackExternalLinks,
  trackReleases,
  trackTags,
  trackWorks,
} from './schema/tracks.js';

/** The core columns of a processed Track, as every catalog listing reads them. */
type CatalogTrackRow = {
  id: string;
  title: string;
  lengthMs: number | null;
  disambiguation: string;
  video: boolean;
  isrcs: string[];
  genres: string[];
};

type TrackIdRows<TRow> = Map<string, Omit<TRow, 'trackId'>[]>;

/**
 * Attaches the deeper MusicBrainz sections (credited artists, releases,
 * works, tags, links) to Track rows, in the order given. Every listing of
 * catalog tracks (an artist's, an album's) answers through here, so they all
 * return the same `CatalogTrack` shape. `toItem` turns each one into the
 * listing's own item (an album adds its disc), reading the row's extra
 * columns without copying them onto the wire. It lives in `database/`
 * because a module reaches another module only through its service, and this
 * query is shared by more than one module. It only reads, and never touches
 * the Music catalog.
 */
export async function attachCatalogTrackDetails<
  TRow extends CatalogTrackRow,
  TItem,
>(
  db: Database,
  rows: TRow[],
  toItem: (track: CatalogTrack, row: TRow) => TItem,
): Promise<TItem[]> {
  if (rows.length === 0) {
    return [];
  }
  const trackIds = rows.map((row) => row.id);
  const [credits, releases, works, tags, links] = await Promise.all([
    fetchCredits(db, trackIds),
    fetchReleases(db, trackIds),
    fetchWorks(db, trackIds),
    fetchTags(db, trackIds),
    fetchExternalLinks(db, trackIds),
  ]);
  return rows.map((row) =>
    toItem(
      {
        id: row.id,
        title: row.title,
        lengthMs: row.lengthMs,
        disambiguation: row.disambiguation,
        video: row.video,
        isrcs: row.isrcs,
        genres: row.genres,
        artists: credits.get(row.id) ?? [],
        releases: releases.get(row.id) ?? [],
        works: works.get(row.id) ?? [],
        tags: tags.get(row.id) ?? [],
        externalLinks: links.get(row.id) ?? [],
      },
      row,
    ),
  );
}

async function fetchCredits(
  db: Database,
  trackIds: string[],
): Promise<TrackIdRows<{ trackId: string; id: string; name: string }>> {
  const rows = await db
    .select({
      trackId: trackArtists.trackId,
      id: artists.id,
      name: artists.name,
    })
    .from(trackArtists)
    .innerJoin(artists, eq(trackArtists.artistId, artists.id))
    .where(inArray(trackArtists.trackId, trackIds))
    .orderBy(asc(artists.name));
  return groupByTrack(rows);
}

async function fetchReleases(
  db: Database,
  trackIds: string[],
): Promise<TrackIdRows<CatalogTrackRelease & { trackId: string }>> {
  const rows = await db
    .select({
      trackId: trackReleases.trackId,
      mbid: trackReleases.mbid,
      title: trackReleases.title,
      year: trackReleases.year,
      coverArtUrl: trackReleases.coverArtUrl,
    })
    .from(trackReleases)
    .where(inArray(trackReleases.trackId, trackIds))
    .orderBy(asc(trackReleases.title), asc(trackReleases.mbid));
  return groupByTrack(rows);
}

async function fetchWorks(
  db: Database,
  trackIds: string[],
): Promise<TrackIdRows<CatalogTrackWork & { trackId: string }>> {
  const rows = await db
    .select({
      trackId: trackWorks.trackId,
      mbid: trackWorks.mbid,
      title: trackWorks.title,
    })
    .from(trackWorks)
    .where(inArray(trackWorks.trackId, trackIds))
    .orderBy(asc(trackWorks.title), asc(trackWorks.mbid));
  return groupByTrack(rows);
}

async function fetchTags(
  db: Database,
  trackIds: string[],
): Promise<TrackIdRows<CatalogTrackTag & { trackId: string }>> {
  const rows = await db
    .select({
      trackId: trackTags.trackId,
      name: trackTags.name,
      count: trackTags.count,
    })
    .from(trackTags)
    .where(inArray(trackTags.trackId, trackIds))
    .orderBy(desc(trackTags.count), asc(trackTags.name));
  return groupByTrack(rows);
}

async function fetchExternalLinks(
  db: Database,
  trackIds: string[],
): Promise<TrackIdRows<CatalogTrackExternalLink & { trackId: string }>> {
  const rows = await db
    .select({
      trackId: trackExternalLinks.trackId,
      url: trackExternalLinks.url,
      linkType: trackExternalLinks.linkType,
    })
    .from(trackExternalLinks)
    .where(inArray(trackExternalLinks.trackId, trackIds))
    .orderBy(asc(trackExternalLinks.linkType), asc(trackExternalLinks.url));
  return groupByTrack(rows);
}

function groupByTrack<T extends { trackId: string }>(
  rows: T[],
): TrackIdRows<T> {
  const byTrack: TrackIdRows<T> = new Map();
  for (const row of rows) {
    const { trackId, ...rest } = row;
    const list = byTrack.get(trackId) ?? [];
    list.push(rest);
    byTrack.set(trackId, list);
  }
  return byTrack;
}
