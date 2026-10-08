import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type {
  CatalogTrack,
  CatalogTrackExternalLink,
  CatalogTrackRelease,
  CatalogTrackTag,
  CatalogTrackWork,
  Mbid,
  TrackArtistCreditEntry,
} from '@notefinder/contracts';
import { asc, desc, eq, inArray } from 'drizzle-orm';
import type { DatabaseAdapter } from '../../database/database.js';
import { artists, trackArtists } from '../../database/schema/artists.js';
import {
  legacyTrackIds,
  trackExternalLinks,
  trackReleases,
  tracks,
  trackTags,
  trackWorks,
} from '../../database/schema/tracks.js';
import type { NewTrackCoreRow, NewTrackRows } from './track-from-recording.js';

type ByTrack<TRow> = Map<string, Omit<TRow, 'trackId'>[]>;

/** The companion rows of a new Track (everything but the core row). */
type NewTrackDetails = Omit<NewTrackRows, 'track'>;

/** The Track fields the Processing page's header shows. */
export type TrackHeaderRow = {
  id: string;
  title: string;
  coverUrl: string | null;
  artistCredit: TrackArtistCreditEntry[];
};

/** Inserts the rows with `insert` when there are any, and does nothing otherwise. */
async function insertIfAny<TRow>(
  rows: readonly TRow[],
  insert: (rows: TRow[]) => Promise<unknown>,
): Promise<void> {
  if (rows.length > 0) {
    await insert([...rows]);
  }
}

/** The rows of one Track, each carrying its Track ID. */
const onTrack = <TRow extends object>(rows: readonly TRow[], trackId: string) =>
  rows.map((row) => ({ ...row, trackId }));

@Injectable()
export class TracksRepository {
  constructor(private readonly txHost: TransactionHost<DatabaseAdapter>) {}

  /**
   * Track ids keyed by recording MBID, for the MBIDs given. Only processed
   * Recordings have a row; the caller maps a miss to null (static card).
   */
  async findTrackIdsByRecordingMbids(
    mbids: Mbid[],
  ): Promise<Map<string, string>> {
    if (mbids.length === 0) {
      return new Map();
    }
    const rows = await this.txHost.tx
      .select({ id: tracks.id, recordingMbid: tracks.recordingMbid })
      .from(tracks)
      .where(inArray(tracks.recordingMbid, mbids));
    return new Map(rows.map((row) => [row.recordingMbid, row.id]));
  }

  /**
   * Inserts the core row of a new Track and returns its ID. When a Track
   * already has the Recording, nothing is written and the answer is undefined:
   * the request that lost a race reads the winner's Track instead. The unique
   * Recording MBID is what makes concurrent requests end in one Track.
   */
  async insertTrack(row: NewTrackCoreRow): Promise<string | undefined> {
    const [inserted] = await this.txHost.tx
      .insert(tracks)
      .values(row)
      .onConflictDoNothing({ target: tracks.recordingMbid })
      .returning({ id: tracks.id });
    return inserted?.id;
  }

  /** The companion rows of a new Track: releases, works, tags and links. */
  async insertTrackDetails(
    trackId: string,
    details: NewTrackDetails,
  ): Promise<void> {
    const db = this.txHost.tx;
    await insertIfAny(details.releases, (rows) =>
      db.insert(trackReleases).values(onTrack(rows, trackId)),
    );
    await insertIfAny(details.works, (rows) =>
      db.insert(trackWorks).values(onTrack(rows, trackId)),
    );
    await insertIfAny(details.tags, (rows) =>
      db.insert(trackTags).values(onTrack(rows, trackId)),
    );
    await insertIfAny(details.externalLinks, (rows) =>
      db.insert(trackExternalLinks).values(onTrack(rows, trackId)),
    );
  }

  /**
   * The header of a Track (title, cover and artist credit), or undefined for an
   * unknown ID.
   */
  async findTrackHeader(trackId: string): Promise<TrackHeaderRow | undefined> {
    const [row] = await this.txHost.tx
      .select({
        id: tracks.id,
        title: tracks.title,
        coverUrl: tracks.coverUrl,
        artistCredit: tracks.artistCredit,
      })
      .from(tracks)
      .where(eq(tracks.id, trackId))
      .limit(1);
    return row;
  }

  /** The Track a legacy Track ID was reprocessed into, if it was. */
  async findTrackIdByLegacyId(legacyId: string): Promise<string | undefined> {
    const [row] = await this.txHost.tx
      .select({ trackId: legacyTrackIds.trackId })
      .from(legacyTrackIds)
      .where(eq(legacyTrackIds.legacyId, legacyId))
      .limit(1);
    return row?.trackId;
  }

  /**
   * The catalog details of the Tracks given: the core fields plus credited
   * artists, releases, works, tags and links, for each Track that exists. The
   * order is unspecified; the service puts the entries in the order it needs.
   * Reads only.
   */
  async findCatalogTracks(trackIds: string[]): Promise<CatalogTrack[]> {
    if (trackIds.length === 0) {
      return [];
    }
    const rows = await this.txHost.tx
      .select({
        id: tracks.id,
        title: tracks.title,
        lengthMs: tracks.lengthMs,
        disambiguation: tracks.disambiguation,
        video: tracks.video,
        isrcs: tracks.isrcs,
        genres: tracks.genres,
      })
      .from(tracks)
      .where(inArray(tracks.id, trackIds));
    const [credits, releases, works, tagsByTrack, links] = await Promise.all([
      this.fetchCredits(trackIds),
      this.fetchReleases(trackIds),
      this.fetchWorks(trackIds),
      this.fetchTags(trackIds),
      this.fetchExternalLinks(trackIds),
    ]);
    return rows.map((row) => ({
      ...row,
      artists: credits.get(row.id) ?? [],
      releases: releases.get(row.id) ?? [],
      works: works.get(row.id) ?? [],
      tags: tagsByTrack.get(row.id) ?? [],
      externalLinks: links.get(row.id) ?? [],
    }));
  }

  private async fetchCredits(
    trackIds: string[],
  ): Promise<ByTrack<{ trackId: string; id: string; name: string }>> {
    const rows = await this.txHost.tx
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

  private async fetchReleases(
    trackIds: string[],
  ): Promise<ByTrack<CatalogTrackRelease & { trackId: string }>> {
    const rows = await this.txHost.tx
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

  private async fetchWorks(
    trackIds: string[],
  ): Promise<ByTrack<CatalogTrackWork & { trackId: string }>> {
    const rows = await this.txHost.tx
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

  private async fetchTags(
    trackIds: string[],
  ): Promise<ByTrack<CatalogTrackTag & { trackId: string }>> {
    const rows = await this.txHost.tx
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

  private async fetchExternalLinks(
    trackIds: string[],
  ): Promise<ByTrack<CatalogTrackExternalLink & { trackId: string }>> {
    const rows = await this.txHost.tx
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
}

function groupByTrack<T extends { trackId: string }>(rows: T[]): ByTrack<T> {
  const byTrack: ByTrack<T> = new Map();
  for (const row of rows) {
    const { trackId, ...rest } = row;
    const list = byTrack.get(trackId) ?? [];
    list.push(rest);
    byTrack.set(trackId, list);
  }
  return byTrack;
}
