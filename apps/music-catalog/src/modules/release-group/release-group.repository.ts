import { asc, eq, inArray } from 'drizzle-orm';
import {
  type CreditedArtistRow,
  selectCreditedArtists,
} from '../../database/credited-artists.js';
import type { Database } from '../../database/database.js';
import type { DatabaseSource } from '../../database/database-ref.js';
import { artistCredit } from '../../database/schema/musicbrainz/artist.js';
import { recording } from '../../database/schema/musicbrainz/recording.js';
import {
  medium,
  release,
  releaseCountry,
  releaseGroup,
  releaseGroupGidRedirect,
  releaseGroupPrimaryType,
  releaseGroupSecondaryType,
  releaseGroupSecondaryTypeJoin,
  releaseGroupTag,
  releaseStatus,
  releaseUnknownCountry,
  track,
} from '../../database/schema/musicbrainz/release.js';
import { genre, tag } from '../../database/schema/musicbrainz/tag.js';
import type { PartialDate } from '../../lib/partial-date.js';
import type { TagVotes } from '../../lib/tag-votes.js';
import type {
  MediumTrackRow,
  ReleaseGroupRow,
  ReleaseWithEvents,
} from './release-group-data.js';

/**
 * Reads one release group (an Album, ADR 0003) from the MusicBrainz tables, by
 * MBID. Read-only: the tables belong to mbslave. Each method is one query.
 */
export class ReleaseGroupRepository {
  private readonly getDb: () => Database;

  constructor(db: DatabaseSource) {
    this.getDb = typeof db === 'function' ? db : () => db;
  }

  async findByMbid(mbid: string): Promise<ReleaseGroupRow | undefined> {
    const [row] = await this.getDb()
      .select({
        id: releaseGroup.id,
        mbid: releaseGroup.gid,
        title: releaseGroup.name,
        primaryType: releaseGroupPrimaryType.name,
        artistCreditId: releaseGroup.artistCredit,
        artistCreditName: artistCredit.name,
      })
      .from(releaseGroup)
      .innerJoin(artistCredit, eq(artistCredit.id, releaseGroup.artistCredit))
      .leftJoin(
        releaseGroupPrimaryType,
        eq(releaseGroupPrimaryType.id, releaseGroup.type),
      )
      .where(eq(releaseGroup.gid, mbid))
      .limit(1);
    return row;
  }

  /**
   * The MBID a merged release group now has, when `mbid` is one MusicBrainz
   * merged away and its target still exists.
   */
  async findMergedInto(mbid: string): Promise<string | undefined> {
    const [row] = await this.getDb()
      .select({ mbid: releaseGroup.gid })
      .from(releaseGroupGidRedirect)
      .innerJoin(
        releaseGroup,
        eq(releaseGroup.id, releaseGroupGidRedirect.newId),
      )
      .where(eq(releaseGroupGidRedirect.gid, mbid))
      .limit(1);
    return row?.mbid;
  }

  findCreditedArtists(artistCreditId: number): Promise<CreditedArtistRow[]> {
    return selectCreditedArtists(this.getDb(), artistCreditId);
  }

  async findSecondaryTypes(releaseGroupId: number): Promise<string[]> {
    const rows = await this.getDb()
      .select({ name: releaseGroupSecondaryType.name })
      .from(releaseGroupSecondaryTypeJoin)
      .innerJoin(
        releaseGroupSecondaryType,
        eq(
          releaseGroupSecondaryType.id,
          releaseGroupSecondaryTypeJoin.secondaryType,
        ),
      )
      .where(eq(releaseGroupSecondaryTypeJoin.releaseGroup, releaseGroupId))
      .orderBy(asc(releaseGroupSecondaryType.name));
    return rows.map((row) => row.name);
  }

  /** The tags of the release group itself, each with its votes. */
  findTagVotes(releaseGroupId: number): Promise<TagVotes[]> {
    return this.getDb()
      .select({
        name: tag.name,
        count: releaseGroupTag.count,
        genreMbid: genre.gid,
      })
      .from(releaseGroupTag)
      .innerJoin(tag, eq(tag.id, releaseGroupTag.tag))
      .leftJoin(genre, eq(genre.name, tag.name))
      .where(eq(releaseGroupTag.releaseGroup, releaseGroupId));
  }

  /**
   * The releases of the group with the dates of their release events, read
   * in two queries: the releases, then every event of those releases.
   */
  async findReleases(releaseGroupId: number): Promise<ReleaseWithEvents[]> {
    const rows = await this.getDb()
      .select({
        id: release.id,
        mbid: release.gid,
        title: release.name,
        status: releaseStatus.name,
      })
      .from(release)
      .leftJoin(releaseStatus, eq(releaseStatus.id, release.status))
      .where(eq(release.releaseGroup, releaseGroupId))
      .orderBy(asc(release.gid));
    const events = await this.findEvents(rows.map((row) => row.id));
    return rows.map((row) => ({
      ...row,
      events: events.filter((event) => event.releaseId === row.id),
    }));
  }

  private async findEvents(
    releaseIds: number[],
  ): Promise<(PartialDate & { releaseId: number })[]> {
    if (releaseIds.length === 0) {
      return [];
    }
    const [inCountry, inUnknownCountry] = await Promise.all([
      this.getDb()
        .select({
          releaseId: releaseCountry.release,
          year: releaseCountry.dateYear,
          month: releaseCountry.dateMonth,
          day: releaseCountry.dateDay,
        })
        .from(releaseCountry)
        .where(inArray(releaseCountry.release, releaseIds)),
      this.getDb()
        .select({
          releaseId: releaseUnknownCountry.release,
          year: releaseUnknownCountry.dateYear,
          month: releaseUnknownCountry.dateMonth,
          day: releaseUnknownCountry.dateDay,
        })
        .from(releaseUnknownCountry)
        .where(inArray(releaseUnknownCountry.release, releaseIds)),
    ]);
    return [...inCountry, ...inUnknownCountry];
  }

  /**
   * The tracks of one release in position order, each with the medium it sits
   * on: a release's media, and the Recording on every track.
   */
  findMedia(releaseId: number): Promise<MediumTrackRow[]> {
    return this.getDb()
      .select({
        mediumPosition: medium.position,
        mediumTitle: medium.name,
        trackPosition: track.position,
        recordingMbid: recording.gid,
      })
      .from(medium)
      .innerJoin(track, eq(track.medium, medium.id))
      .innerJoin(recording, eq(recording.id, track.recording))
      .where(eq(medium.release, releaseId))
      .orderBy(asc(medium.position), asc(track.position), asc(recording.gid));
  }
}
