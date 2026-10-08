import { eq } from 'drizzle-orm';
import type { Database } from '../../database/database.js';
import type { DatabaseSource } from '../../database/database-ref.js';
import {
  artist,
  artistGidRedirect,
  artistTag,
} from '../../database/schema/musicbrainz/artist.js';
import { genre, tag } from '../../database/schema/musicbrainz/tag.js';
import type { TagVotes } from '../../lib/tag-votes.js';
import type { ArtistRow } from './artist-data.js';

/**
 * Reads one artist from the MusicBrainz tables, by MBID. Read-only: the
 * tables belong to mbslave. Each method is one query.
 */
export class ArtistRepository {
  private readonly getDb: () => Database;

  constructor(db: DatabaseSource) {
    this.getDb = typeof db === 'function' ? db : () => db;
  }

  async findByMbid(mbid: string): Promise<ArtistRow | undefined> {
    const [row] = await this.getDb()
      .select({ id: artist.id, mbid: artist.gid, name: artist.name })
      .from(artist)
      .where(eq(artist.gid, mbid))
      .limit(1);
    return row;
  }

  /**
   * The MBID a merged artist now has, when `mbid` is one MusicBrainz merged
   * away and its target still exists.
   */
  async findMergedInto(mbid: string): Promise<string | undefined> {
    const [row] = await this.getDb()
      .select({ mbid: artist.gid })
      .from(artistGidRedirect)
      .innerJoin(artist, eq(artist.id, artistGidRedirect.newId))
      .where(eq(artistGidRedirect.gid, mbid))
      .limit(1);
    return row?.mbid;
  }

  /** The tags of the artist itself, each with its votes. */
  findTagVotes(artistId: number): Promise<TagVotes[]> {
    return this.getDb()
      .select({
        name: tag.name,
        count: artistTag.count,
        genreMbid: genre.gid,
      })
      .from(artistTag)
      .innerJoin(tag, eq(tag.id, artistTag.tag))
      .leftJoin(genre, eq(genre.name, tag.name))
      .where(eq(artistTag.artist, artistId));
  }
}
