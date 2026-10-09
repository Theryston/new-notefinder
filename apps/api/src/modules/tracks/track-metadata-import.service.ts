import { Injectable, Logger } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import type {
  Mbid,
  MusicCatalogArtist,
  MusicCatalogReleaseGroup,
  Recording,
} from '@notefinder/contracts';
import { MusicCatalogClient } from '../../integrations/music-catalog/music-catalog.client.js';
import { TrackAlbumCoverService } from './track-album-cover.service.js';
import { TrackMetadataRepository } from './track-metadata.repository.js';
import { mapWithConcurrency } from './track-metadata-concurrency.js';
import {
  type AlbumPlacement,
  albumLayoutOf,
} from './track-metadata-placement.js';

/** The Artists and Albums an import linked a Track to: the rows it now shows on. */
export type ImportedLinks = { artistIds: string[]; albumIds: string[] };

const NOTHING_LINKED: ImportedLinks = { artistIds: [], albumIds: [] };

/** How many catalog lookups (and cover downloads) one step runs at once. */
const CONCURRENCY = 4;

/** The Artist IDs of one import run, by MBID, so each Artist is fetched once. */
type ArtistMemo = Map<string, Promise<string | undefined>>;

/** What the Album writes of one Track need, in one object (too many for positional params). */
type AlbumLink = {
  albumId: string;
  trackId: string;
  recordingMbid: string;
  ownPlacements: AlbumPlacement[];
  group: MusicCatalogReleaseGroup;
  artistIds: string[];
};

const isDefined = <T>(value: T | undefined): value is T => value !== undefined;

/** The distinct values, in the order they first appear. */
const distinct = (values: readonly string[]): string[] => [...new Set(values)];

/** The release groups a Recording is on, each once, in the order its releases list them. */
const releaseGroupsOf = (recording: Recording): string[] =>
  distinct(recording.releases.map((release) => release.releaseGroup.mbid));

/** Where the Recording sits on its own releases within one release group. */
const ownPlacementsIn = (
  recording: Recording,
  groupMbid: string,
): AlbumPlacement[] =>
  recording.releases
    .filter((release) => release.releaseGroup.mbid === groupMbid)
    .map((release) => ({
      discPosition: release.mediumPosition,
      trackPosition: release.trackPosition,
    }));

/**
 * Imports the Artists and Albums of a Track's Recording from the Music catalog
 * (ADR 0003 and ADR 0005). Idempotent: every write upserts or replaces its own
 * rows, so a repeated run lands on the same rows. A catalog answer that is
 * neither a result nor a merge is skipped with a log line; a failed call
 * throws, and the job retries it.
 */
@Injectable()
export class TrackMetadataImportService {
  private readonly logger = new Logger(TrackMetadataImportService.name);

  constructor(
    private readonly repository: TrackMetadataRepository,
    private readonly catalog: MusicCatalogClient,
    private readonly covers: TrackAlbumCoverService,
  ) {}

  /**
   * Imports the Recording's Artists, linked to the Track, then every Album the
   * Recording is on. The Albums run with bounded concurrency; each Album's
   * writes are one unit of their own.
   */
  async importMetadata(trackId: string): Promise<ImportedLinks> {
    const recording = await this.findTrackRecording(trackId);
    if (recording === undefined) {
      return NOTHING_LINKED;
    }
    const memo: ArtistMemo = new Map();
    const artistIds = await this.linkTrackArtists(trackId, recording, memo);
    const albumIds = await mapWithConcurrency(
      releaseGroupsOf(recording),
      CONCURRENCY,
      (groupMbid) => this.importAlbum(trackId, recording, groupMbid, memo),
    );
    return { artistIds, albumIds: albumIds.filter(isDefined) };
  }

  private async findTrackRecording(
    trackId: string,
  ): Promise<Recording | undefined> {
    const mbid = await this.repository.findRecordingMbid(trackId);
    if (mbid === undefined) {
      this.logger.warn(`Track ${trackId} is gone: nothing to import`);
      return undefined;
    }
    const recording = await this.findRecording(mbid);
    if (recording === undefined) {
      this.logger.warn(`The Music catalog has no Recording for ${trackId}`);
    }
    return recording;
  }

  private async linkTrackArtists(
    trackId: string,
    recording: Recording,
    memo: ArtistMemo,
  ): Promise<string[]> {
    const artistIds = await this.resolveArtists(
      recording.artistCredit.artists.map((artist) => artist.mbid),
      memo,
    );
    await this.repository.linkTrackArtists(trackId, artistIds);
    return artistIds;
  }

  /** Imports one Album of the Recording; answers its ID, or nothing when the catalog does not know it. */
  private async importAlbum(
    trackId: string,
    recording: Recording,
    groupMbid: string,
    memo: ArtistMemo,
  ): Promise<string | undefined> {
    const group = await this.findReleaseGroup(groupMbid);
    if (group === undefined) {
      return undefined;
    }
    const artistIds = await this.resolveArtists(
      group.artistCredit.artists.map((artist) => artist.mbid),
      memo,
    );
    const album = await this.repository.upsertAlbum({
      mbid: group.mbid,
      title: group.title,
      primaryType: group.primaryType,
      secondaryTypes: group.secondaryTypes,
      year: group.firstReleaseYear,
      genres: group.genres.map((genre) => genre.name),
    });
    // Outside the Album's transaction: a cover download is slow and may fail.
    if (!album.hasCover) {
      await this.storeAlbumCover(album.id, group.coverArtUrl);
    }
    await this.linkAlbum({
      albumId: album.id,
      trackId,
      recordingMbid: recording.mbid,
      ownPlacements: ownPlacementsIn(recording, groupMbid),
      group,
      artistIds,
    });
    return album.id;
  }

  private async storeAlbumCover(
    albumId: string,
    coverArtUrl: string,
  ): Promise<void> {
    const url = await this.covers.storeCover(albumId, coverArtUrl);
    if (url !== undefined) {
      await this.repository.setAlbumCoverUrl(albumId, url);
    }
  }

  /**
   * The Album's credit, discs and the Track's place on it, as one unit: a
   * Track is never listed on an Album whose discs are missing.
   */
  @Transactional()
  private async linkAlbum(link: AlbumLink): Promise<void> {
    await this.repository.replaceAlbumArtists(link.albumId, link.artistIds);
    const layout = albumLayoutOf({
      recordingMbid: link.recordingMbid,
      media: link.group.representativeRelease?.media ?? [],
      ownPlacements: link.ownPlacements,
    });
    if (layout === undefined) {
      this.logger.warn(
        `Track ${link.trackId} has no place on Album ${link.albumId}`,
      );
      return;
    }
    await this.repository.upsertAlbumDiscs(link.albumId, layout.discs);
    await this.repository.upsertAlbumTrack(
      link.albumId,
      link.trackId,
      layout.placement,
    );
  }

  /** The Artists of a credit, each once, in credit order; the ones the catalog does not know are left out. */
  private async resolveArtists(
    mbids: readonly string[],
    memo: ArtistMemo,
  ): Promise<string[]> {
    const ids = await mapWithConcurrency(distinct(mbids), CONCURRENCY, (mbid) =>
      this.resolveArtist(mbid, memo),
    );
    return ids.filter(isDefined);
  }

  /** One Artist's ID, fetched and written once per import run, however many credits name it. */
  private resolveArtist(
    mbid: string,
    memo: ArtistMemo,
  ): Promise<string | undefined> {
    const known = memo.get(mbid);
    if (known !== undefined) {
      return known;
    }
    const resolved = this.importArtist(mbid);
    memo.set(mbid, resolved);
    return resolved;
  }

  private async importArtist(mbid: string): Promise<string | undefined> {
    const artist = await this.findArtist(mbid);
    if (artist === undefined) {
      return undefined;
    }
    return this.repository.upsertArtist({
      mbid: artist.mbid,
      name: artist.name,
      genres: artist.genres.map((genre) => genre.name),
    });
  }

  private async findRecording(mbid: Mbid): Promise<Recording | undefined> {
    const lookup = await this.catalog.getRecording(mbid);
    if (lookup.status === 'found') {
      return lookup.recording;
    }
    if (lookup.status === 'not-found') {
      return undefined;
    }
    const moved = await this.catalog.getRecording(lookup.newMbid);
    return moved.status === 'found' ? moved.recording : undefined;
  }

  private async findReleaseGroup(
    mbid: Mbid,
  ): Promise<MusicCatalogReleaseGroup | undefined> {
    const lookup = await this.catalog.getReleaseGroup(mbid);
    if (lookup.status === 'found') {
      return lookup.releaseGroup;
    }
    if (lookup.status === 'not-found') {
      this.logger.warn(`The Music catalog has no release group ${mbid}`);
      return undefined;
    }
    const moved = await this.catalog.getReleaseGroup(lookup.newMbid);
    return moved.status === 'found' ? moved.releaseGroup : undefined;
  }

  private async findArtist(
    mbid: Mbid,
  ): Promise<MusicCatalogArtist | undefined> {
    const lookup = await this.catalog.getArtist(mbid);
    if (lookup.status === 'found') {
      return lookup.artist;
    }
    if (lookup.status === 'not-found') {
      this.logger.warn(`The Music catalog has no artist ${mbid}`);
      return undefined;
    }
    const moved = await this.catalog.getArtist(lookup.newMbid);
    return moved.status === 'found' ? moved.artist : undefined;
  }
}
