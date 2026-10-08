import type { DatabaseSource } from '../../database/database-ref.js';
import {
  type Ids,
  idOf,
  MusicBrainzRowWriter,
} from './musicbrainz-rows.repository.js';
import {
  creditKey,
  type TinySeed,
  tinySeed,
  tinySeedCredits,
  tinySeedTagNames,
} from './tiny-seed.js';

/** What a release and its tracks refer to. */
type ReleaseRefs = { areas: Ids; credits: Ids; groups: Ids; recordings: Ids };

/**
 * Writes the `tiny` dataset of `tiny-seed.ts` with plain SQL the way a dump
 * would (not through the service's own Drizzle tables, so a wrong column
 * name there fails the suite instead of passing twice). Runs once per
 * restore, right after `init --empty`, on an empty schema, so the lookup
 * tables (release status, primary type) get only the values the seed uses.
 */
export class TinySeedRepository {
  private readonly rows: MusicBrainzRowWriter;

  constructor(db: DatabaseSource) {
    this.rows = new MusicBrainzRowWriter(db);
  }

  /** Seeds the catalog and returns how many Recordings were written. */
  async seed(seed: TinySeed = tinySeed): Promise<number> {
    const areas = await this.insertAreas(seed);
    const artists = await this.insertArtists(seed);
    const credits = await this.insertCredits(seed, artists);
    const groups = await this.insertReleaseGroups(seed, credits);
    const recordings = await this.insertRecordings(seed, credits);
    await this.insertReleases(seed, { areas, credits, groups, recordings });
    return seed.recordings.length;
  }

  /** Returns the country areas by their ISO 3166-1 code. */
  private async insertAreas(seed: TinySeed): Promise<Ids> {
    const ids = await this.rows.insertReturning(
      'area',
      ['gid', 'name'],
      seed.areas.map((area) => [area.mbid, area.name]),
    );
    const byCode = new Map(
      seed.areas.map((area) => [area.code, idOf(ids, area.mbid)]),
    );
    await this.rows.insert(
      'iso_3166_1',
      ['area', 'code'],
      [...byCode].map(([code, area]) => [area, code]),
    );
    await this.rows.insert(
      'country_area',
      ['area'],
      [...byCode.values()].map((area) => [area]),
    );
    return byCode;
  }

  private async insertArtists(seed: TinySeed): Promise<Ids> {
    const ids = await this.rows.insertReturning(
      'artist',
      ['gid', 'name', 'sort_name'],
      seed.artists.map((artist) => [artist.mbid, artist.name, artist.sortName]),
    );
    await this.rows.insert(
      'artist_alias',
      ['artist', 'name', 'sort_name'],
      seed.artists.flatMap((artist) =>
        artist.aliases.map((alias) => [
          idOf(ids, artist.mbid),
          alias.name,
          alias.sortName,
        ]),
      ),
    );
    return ids;
  }

  /** Returns the credits by their `creditKey`. */
  private async insertCredits(seed: TinySeed, artists: Ids): Promise<Ids> {
    const credits = tinySeedCredits(seed);
    const ids = await this.rows.insertReturning(
      'artist_credit',
      ['gid', 'name', 'artist_count'],
      credits.map((credit) => [
        credit.mbid,
        credit.name,
        credit.entries.length,
      ]),
    );
    await this.rows.insert(
      'artist_credit_name',
      ['artist_credit', 'position', 'artist', 'name', 'join_phrase'],
      credits.flatMap((credit) =>
        credit.entries.map((entry, position) => [
          idOf(ids, credit.mbid),
          position,
          idOf(artists, entry.artist),
          entry.name,
          entry.joinPhrase,
        ]),
      ),
    );
    return new Map(
      credits.map((credit) => [credit.key, idOf(ids, credit.mbid)]),
    );
  }

  private async insertReleaseGroups(
    seed: TinySeed,
    credits: Ids,
  ): Promise<Ids> {
    const types = await this.rows.insertReturning(
      'release_group_primary_type',
      ['gid', 'name'],
      seed.releaseGroupPrimaryTypes.map((type) => [type.mbid, type.name]),
      'name',
    );
    const ids = await this.rows.insertReturning(
      'release_group',
      ['gid', 'name', 'artist_credit', 'type'],
      seed.releaseGroups.map((group) => [
        group.mbid,
        group.title,
        idOf(credits, creditKey(group.artistCredit)),
        group.primaryType === null ? null : idOf(types, group.primaryType),
      ]),
    );
    await this.insertTags(seed, ids);
    return ids;
  }

  /** The release groups' tags, and the genres among them. */
  private async insertTags(seed: TinySeed, groups: Ids): Promise<void> {
    const tags = await this.rows.insertReturning(
      'tag',
      ['name'],
      tinySeedTagNames(seed).map((name) => [name]),
      'name',
    );
    await this.rows.insert(
      'genre',
      ['gid', 'name'],
      seed.genres.map((genre) => [genre.mbid, genre.name]),
    );
    await this.rows.insert(
      'release_group_tag',
      ['release_group', 'tag', 'count'],
      seed.releaseGroups.flatMap((group) =>
        group.tags.map((tag) => [
          idOf(groups, group.mbid),
          idOf(tags, tag.name),
          tag.count,
        ]),
      ),
    );
  }

  private async insertRecordings(seed: TinySeed, credits: Ids): Promise<Ids> {
    const ids = await this.rows.insertReturning(
      'recording',
      ['gid', 'name', 'artist_credit', 'length', 'comment', 'video'],
      seed.recordings.map((recording) => [
        recording.mbid,
        recording.title,
        idOf(credits, creditKey(recording.artistCredit)),
        recording.lengthMs,
        recording.disambiguation,
        recording.video,
      ]),
    );
    await this.rows.insert(
      'isrc',
      ['recording', 'isrc'],
      seed.recordings.flatMap((recording) =>
        recording.isrcs.map((isrc) => [idOf(ids, recording.mbid), isrc]),
      ),
    );
    return ids;
  }

  private async insertReleases(
    seed: TinySeed,
    refs: ReleaseRefs,
  ): Promise<void> {
    const statuses = await this.rows.insertReturning(
      'release_status',
      ['gid', 'name'],
      seed.releaseStatuses.map((status) => [status.mbid, status.name]),
      'name',
    );
    const ids = await this.rows.insertReturning(
      'release',
      ['gid', 'name', 'artist_credit', 'release_group', 'status'],
      seed.releases.map((release) => [
        release.mbid,
        release.title,
        idOf(refs.credits, creditKey(release.artistCredit)),
        idOf(refs.groups, release.releaseGroup),
        release.status === null ? null : idOf(statuses, release.status),
      ]),
    );
    await this.insertReleaseEvents(seed, ids, refs.areas);
    await this.insertMediaAndTracks(seed, ids, refs);
  }

  private async insertReleaseEvents(
    seed: TinySeed,
    releases: Ids,
    areas: Ids,
  ): Promise<void> {
    const events = seed.releases.flatMap((release) =>
      release.events.map((event) => ({
        ...event,
        release: idOf(releases, release.mbid),
      })),
    );
    const date = (event: (typeof events)[number]) => [
      event.year,
      event.month,
      event.day,
    ];
    await this.rows.insert(
      'release_country',
      ['release', 'country', 'date_year', 'date_month', 'date_day'],
      events.flatMap((event) =>
        event.country === null
          ? []
          : [[event.release, idOf(areas, event.country), ...date(event)]],
      ),
    );
    await this.rows.insert(
      'release_unknown_country',
      ['release', 'date_year', 'date_month', 'date_day'],
      events
        .filter((event) => event.country === null)
        .map((event) => [event.release, ...date(event)]),
    );
  }

  private async insertMediaAndTracks(
    seed: TinySeed,
    releases: Ids,
    refs: ReleaseRefs,
  ): Promise<void> {
    const media = seed.releases.flatMap((release) => release.media);
    const mediumIds = await this.rows.insertReturning(
      'medium',
      ['gid', 'release', 'position', 'name', 'track_count'],
      seed.releases.flatMap((release) =>
        release.media.map((medium) => [
          medium.mbid,
          idOf(releases, release.mbid),
          medium.position,
          medium.title,
          medium.tracks.length,
        ]),
      ),
    );
    const creditOf = new Map(
      seed.recordings.map((recording) => [
        recording.mbid,
        idOf(refs.credits, creditKey(recording.artistCredit)),
      ]),
    );
    await this.rows.insert(
      'track',
      [
        ...['gid', 'recording', 'medium', 'position', 'number', 'name'],
        ...['artist_credit', 'length'],
      ],
      media.flatMap((medium) =>
        medium.tracks.map((track) => [
          track.mbid,
          idOf(refs.recordings, track.recording),
          idOf(mediumIds, medium.mbid),
          track.position,
          track.number,
          track.title,
          idOf(creditOf, track.recording),
          track.lengthMs,
        ]),
      ),
    );
  }
}
