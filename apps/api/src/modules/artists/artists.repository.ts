import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type {
  Artist,
  ArtistTrack,
  ArtistTrackExternalLink,
  ArtistTrackRelease,
  ArtistTrackTag,
  ArtistTrackWork,
} from '@notefinder/contracts';
import { and, asc, count, desc, eq, gt, inArray } from 'drizzle-orm';
import type { DatabaseAdapter } from '../../database/database.js';
import {
  artists,
  legacyArtistIds,
  trackArtists,
} from '../../database/schema/artists.js';
import {
  trackExternalLinks,
  trackReleases,
  tracks,
  trackTags,
  trackWorks,
} from '../../database/schema/tracks.js';

@Injectable()
export class ArtistsRepository {
  constructor(private readonly txHost: TransactionHost<DatabaseAdapter>) {}

  /**
   * The Artist with its processed-track count, or nothing when no Artist
   * has this ID. The count comes from the artist-track links, so it is
   * zero for an Artist with no processed Tracks yet.
   */
  async findArtistById(id: string): Promise<Artist | undefined> {
    const [row] = await this.txHost.tx
      .select({
        id: artists.id,
        mbid: artists.mbid,
        name: artists.name,
        genres: artists.genres,
      })
      .from(artists)
      .where(eq(artists.id, id))
      .limit(1);
    if (!row) {
      return undefined;
    }
    return { ...row, trackCount: await this.countTracks(id) };
  }

  /** The new ID a legacy artist ID points to, if it was reprocessed. */
  async findArtistIdByLegacyId(legacyId: string): Promise<string | undefined> {
    const [row] = await this.txHost.tx
      .select({ artistId: legacyArtistIds.artistId })
      .from(legacyArtistIds)
      .where(eq(legacyArtistIds.legacyId, legacyId))
      .limit(1);
    return row?.artistId;
  }

  private async countTracks(artistId: string): Promise<number> {
    const [row] = await this.txHost.tx
      .select({ value: count() })
      .from(trackArtists)
      .where(eq(trackArtists.artistId, artistId));
    return row?.value ?? 0;
  }

  /**
   * One page of the Artist's processed Tracks in stable `id` order, one
   * entry per Recording with its deeper MusicBrainz sections (releases,
   * works, tags, links) for the Track page. Keyset over the link table:
   * the cursor is a Track ID the service already decoded, `limit + 1`
   * rows decide the next cursor.
   */
  async findTracksByArtistId(
    artistId: string,
    options: { cursorTrackId?: string; limit: number },
  ): Promise<{ items: ArtistTrack[]; nextCursor: string | null }> {
    const { cursorTrackId, limit } = options;
    const conditions = cursorTrackId
      ? and(eq(trackArtists.artistId, artistId), gt(tracks.id, cursorTrackId))
      : eq(trackArtists.artistId, artistId);

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
      .from(trackArtists)
      .innerJoin(tracks, eq(trackArtists.trackId, tracks.id))
      .where(conditions)
      .orderBy(asc(tracks.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    if (page.length === 0) {
      return { items: [], nextCursor: null };
    }
    const trackIds = page.map((row) => row.id);
    const items = await this.buildTrackItems(page, trackIds);

    const last = page[page.length - 1];
    if (!last || !hasMore) {
      return { items, nextCursor: null };
    }
    return {
      items,
      nextCursor: Buffer.from(last.id, 'utf8').toString('base64url'),
    };
  }

  private async buildTrackItems(
    page: {
      id: string;
      title: string;
      lengthMs: number | null;
      disambiguation: string;
      video: boolean;
      isrcs: string[];
      genres: string[];
    }[],
    trackIds: string[],
  ): Promise<ArtistTrack[]> {
    const [credits, releases, works, tags, links] = await Promise.all([
      this.fetchCredits(trackIds),
      this.fetchReleases(trackIds),
      this.fetchWorks(trackIds),
      this.fetchTags(trackIds),
      this.fetchExternalLinks(trackIds),
    ]);
    return page.map((row) => ({
      ...row,
      artists: credits.get(row.id) ?? [],
      releases: releases.get(row.id) ?? [],
      works: works.get(row.id) ?? [],
      tags: tags.get(row.id) ?? [],
      externalLinks: links.get(row.id) ?? [],
    }));
  }

  private async fetchCredits(
    trackIds: string[],
  ): Promise<Map<string, { id: string; name: string }[]>> {
    const creditRows = await this.txHost.tx
      .select({
        trackId: trackArtists.trackId,
        id: artists.id,
        name: artists.name,
      })
      .from(trackArtists)
      .innerJoin(artists, eq(trackArtists.artistId, artists.id))
      .where(inArray(trackArtists.trackId, trackIds))
      .orderBy(asc(artists.name));
    return this.groupByTrack(creditRows);
  }

  private async fetchReleases(
    trackIds: string[],
  ): Promise<Map<string, ArtistTrackRelease[]>> {
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
    return this.groupByTrack(rows);
  }

  private async fetchWorks(
    trackIds: string[],
  ): Promise<Map<string, ArtistTrackWork[]>> {
    const rows = await this.txHost.tx
      .select({
        trackId: trackWorks.trackId,
        mbid: trackWorks.mbid,
        title: trackWorks.title,
      })
      .from(trackWorks)
      .where(inArray(trackWorks.trackId, trackIds))
      .orderBy(asc(trackWorks.title), asc(trackWorks.mbid));
    return this.groupByTrack(rows);
  }

  private async fetchTags(
    trackIds: string[],
  ): Promise<Map<string, ArtistTrackTag[]>> {
    const rows = await this.txHost.tx
      .select({
        trackId: trackTags.trackId,
        name: trackTags.name,
        count: trackTags.count,
      })
      .from(trackTags)
      .where(inArray(trackTags.trackId, trackIds))
      .orderBy(desc(trackTags.count), asc(trackTags.name));
    return this.groupByTrack(rows);
  }

  private async fetchExternalLinks(
    trackIds: string[],
  ): Promise<Map<string, ArtistTrackExternalLink[]>> {
    const rows = await this.txHost.tx
      .select({
        trackId: trackExternalLinks.trackId,
        url: trackExternalLinks.url,
        linkType: trackExternalLinks.linkType,
      })
      .from(trackExternalLinks)
      .where(inArray(trackExternalLinks.trackId, trackIds))
      .orderBy(asc(trackExternalLinks.linkType), asc(trackExternalLinks.url));
    return this.groupByTrack(rows);
  }

  private groupByTrack<T extends { trackId: string }>(
    rows: (T & { trackId: string })[],
  ): Map<string, Omit<T, 'trackId'>[]> {
    const byTrack = new Map<string, Omit<T, 'trackId'>[]>();
    for (const row of rows) {
      const { trackId, ...rest } = row;
      const list = byTrack.get(trackId) ?? [];
      list.push(rest as Omit<T, 'trackId'>);
      byTrack.set(trackId, list);
    }
    return byTrack;
  }
}
