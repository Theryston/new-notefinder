import { sql } from 'drizzle-orm';
import type { Database } from '../../database/database.js';
import {
  type TinySeedRecording,
  tinyArtistCreditMbid,
  tinySeedRecordings,
} from './tiny-seed.js';

type TinySeedArtist = { mbid: string; name: string };

const uniqueArtists = (
  recordings: readonly TinySeedRecording[],
): TinySeedArtist[] => {
  const seen = new Map<string, TinySeedArtist>();
  for (const recording of recordings) {
    if (!seen.has(recording.artistMbid)) {
      seen.set(recording.artistMbid, {
        mbid: recording.artistMbid,
        name: recording.artistName,
      });
    }
  }
  return [...seen.values()];
};

const musicbrainz = (table: string) =>
  sql`${sql.identifier('musicbrainz')}.${sql.identifier(table)}`;

/**
 * Writes the `tiny` dataset: the deterministic Recordings of
 * `tiny-seed.ts`, with plain SQL the way a dump would (not through the
 * service's own Drizzle tables, so a wrong column name there fails the
 * suite instead of passing twice). Runs once per restore, right after
 * `init --empty`, on an empty schema.
 */
export class TinySeedRepository {
  constructor(private readonly db: Database) {}

  /** Seeds the entries and returns how many Recordings were written. */
  async seed(
    recordings: readonly TinySeedRecording[] = tinySeedRecordings(),
  ): Promise<number> {
    const artists = uniqueArtists(recordings);
    const artistIds = await this.insertArtists(artists);
    const creditIds = await this.insertArtistCredits(artists, artistIds);
    await this.insertRecordings(recordings, creditIds);
    return recordings.length;
  }

  private async insertArtists(
    artists: readonly TinySeedArtist[],
  ): Promise<Map<string, number>> {
    const values = artists.map(
      (artist) => sql`(${artist.mbid}, ${artist.name}, ${artist.name})`,
    );
    const rows = await this.db.execute<{ id: number; gid: string }>(sql`
      insert into ${musicbrainz('artist')} (gid, name, sort_name)
      values ${sql.join(values, sql`, `)}
      returning id, gid`);
    return new Map(rows.rows.map((row) => [row.gid, row.id]));
  }

  private async insertArtistCredits(
    artists: readonly TinySeedArtist[],
    artistIds: Map<string, number>,
  ): Promise<Map<string, number>> {
    const credits = artists.map((artist, index) => ({
      artist,
      gid: tinyArtistCreditMbid(index + 1),
    }));
    const values = credits.map(
      (credit) => sql`(${credit.gid}, ${credit.artist.name}, 1)`,
    );
    const rows = await this.db.execute<{ id: number; gid: string }>(sql`
      insert into ${musicbrainz('artist_credit')} (gid, name, artist_count)
      values ${sql.join(values, sql`, `)}
      returning id, gid`);
    const creditIds = new Map(rows.rows.map((row) => [row.gid, row.id]));
    const names = credits.map((credit) => {
      const creditId = creditIds.get(credit.gid);
      const artistId = artistIds.get(credit.artist.mbid);
      if (creditId === undefined || artistId === undefined) {
        throw new Error('The tiny seed lost an artist row it just wrote');
      }
      return sql`(${creditId}, 0, ${artistId}, ${credit.artist.name}, ${''})`;
    });
    await this.db.execute(sql`
      insert into ${musicbrainz('artist_credit_name')}
        (artist_credit, position, artist, name, join_phrase)
      values ${sql.join(names, sql`, `)}`);
    const byArtist = new Map<string, number>();
    for (const credit of credits) {
      const creditId = creditIds.get(credit.gid);
      if (creditId !== undefined) {
        byArtist.set(credit.artist.mbid, creditId);
      }
    }
    return byArtist;
  }

  private async insertRecordings(
    recordings: readonly TinySeedRecording[],
    creditIds: Map<string, number>,
  ): Promise<void> {
    const values = recordings.map((recording) => {
      const creditId = creditIds.get(recording.artistMbid);
      if (creditId === undefined) {
        throw new Error('The tiny seed lost an artist row it just wrote');
      }
      return sql`(${recording.mbid}, ${recording.title}, ${creditId}, ${recording.lengthMs}, ${''}, ${false})`;
    });
    await this.db.execute(sql`
      insert into ${musicbrainz('recording')}
        (gid, name, artist_credit, length, comment, video)
      values ${sql.join(values, sql`, `)}`);
  }
}
