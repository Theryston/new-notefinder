import { asc, eq } from 'drizzle-orm';
import type { Database } from './database.js';
import { artist, artistCreditName } from './schema/musicbrainz/artist.js';

/**
 * The artists of an artist credit, in credit order, each with the name it is
 * credited under. Shared by every entity that carries a credit (a Recording,
 * a release group): one query, so the credit reads the same everywhere.
 */
export const selectCreditedArtists = (db: Database, artistCreditId: number) =>
  db
    .select({
      mbid: artist.gid,
      name: artist.name,
      creditedName: artistCreditName.name,
      joinPhrase: artistCreditName.joinPhrase,
    })
    .from(artistCreditName)
    .innerJoin(artist, eq(artist.id, artistCreditName.artist))
    .where(eq(artistCreditName.artistCredit, artistCreditId))
    .orderBy(asc(artistCreditName.position));
