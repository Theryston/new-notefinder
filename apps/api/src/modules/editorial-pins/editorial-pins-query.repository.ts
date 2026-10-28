import type { TransactionHost } from '@nestjs-cls/transactional';
import type {
  EditorialPinActor,
  EditorialPinDynamicSource,
  EditorialPinKind,
} from '@vozzify/contracts';
import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  lt,
  or,
  type SQL,
  sql,
} from 'drizzle-orm';
import { type AnyPgColumn, alias } from 'drizzle-orm/pg-core';
import type { DatabaseAdapter } from '../../database/database.js';
import { albums, albumTracks } from '../../database/schema/albums.js';
import { artists, trackArtists } from '../../database/schema/artists.js';
import type { editorialPins } from '../../database/schema/editorial-pins.js';
import { hasCompletedProcessing } from '../../database/schema/track-processings.js';
import {
  type StoredArtistCreditEntry,
  tracks,
} from '../../database/schema/tracks.js';
import { users } from '../../database/schema/users.js';
import type {
  EditorialPinWrite,
  PageCursor,
  SourceTrackQuery,
} from './editorial-pin-state.js';

/** Millisecond precision, the one a cursor carries, so pages never skip a row. */
export const createdAtMs = (column: AnyPgColumn): SQL<Date> =>
  sql`date_trunc('milliseconds', ${column})`;

/** Rows older than the cursor: the rows after it in newest-first order (the ID breaks a tie in creation time). */
export const olderThanCursor = (
  column: SQL<Date>,
  idColumn: AnyPgColumn,
  cursor: PageCursor | undefined,
): SQL | undefined =>
  cursor
    ? or(
        lt(column, cursor.createdAt),
        and(eq(column, cursor.createdAt), lt(idColumn, cursor.id)),
      )
    : undefined;

export const createdByUser = alias(users, 'created_by_user');
export const updatedByUser = alias(users, 'updated_by_user');
export const actorUser = alias(users, 'actor_user');

/** An admin, when the joined User row exists (a removed admin reads as none). */
export const actorOf = (
  id: string | null,
  name: string | null,
): EditorialPinActor | null =>
  id !== null && name !== null ? { id, name } : null;

/** The source columns of a pin: the kind, and the one reference it names. */
const sourceColumns = (source: EditorialPinDynamicSource | null) => ({
  sourceType: source?.type ?? ('tracks' as const),
  sourceGenre: source?.type === 'genre' ? source.genre : null,
  sourceArtistId: source?.type === 'artist' ? source.artistId : null,
  sourceAlbumId: source?.type === 'album' ? source.albumId : null,
});

/**
 * The columns an insert or an update writes for a pin's own fields. The Tracks
 * of a `tracks` source go to their own table, not here.
 */
export const pinColumns = ({
  trackIds: _trackIds,
  dynamicSource,
  ...columns
}: EditorialPinWrite) => ({
  ...columns,
  ...sourceColumns(dynamicSource ?? null),
});

/** The dynamic source a stored pin names, or null for a `tracks` source. */
export const dynamicSourceOf = (
  row: typeof editorialPins.$inferSelect,
): EditorialPinDynamicSource | null => {
  if (row.sourceType === 'genre' && row.sourceGenre !== null) {
    return { type: 'genre', genre: row.sourceGenre };
  }
  if (row.sourceType === 'artist' && row.sourceArtistId !== null) {
    return { type: 'artist', artistId: row.sourceArtistId };
  }
  if (row.sourceType === 'album' && row.sourceAlbumId !== null) {
    return { type: 'album', albumId: row.sourceAlbumId };
  }
  return null;
};

/**
 * The completed Tracks a genre, artist or album offers, best first: a genre's
 * or an Artist's by trending score, an Album's in album order. Read at feed
 * time, so a Track processed later shows without an edit of the pin.
 */
export const selectSourceTrackIds = async (
  txHost: TransactionHost<DatabaseAdapter>,
  source: EditorialPinDynamicSource,
  query: SourceTrackQuery,
): Promise<string[]> => {
  const eligible = and(
    hasCompletedProcessing(tracks.id),
    query.requireCover ? isNotNull(tracks.coverUrl) : undefined,
  );
  const { tx } = txHost;
  const byScore = [desc(tracks.trendingScore), asc(tracks.id)];
  const rows =
    source.type === 'genre'
      ? await tx
          .select({ id: tracks.id })
          .from(tracks)
          .where(and(eligible, sql`${source.genre} = any(${tracks.genres})`))
          .orderBy(...byScore)
          .limit(query.limit)
      : source.type === 'artist'
        ? await tx
            .select({ id: tracks.id })
            .from(trackArtists)
            .innerJoin(tracks, eq(trackArtists.trackId, tracks.id))
            .where(and(eligible, eq(trackArtists.artistId, source.artistId)))
            .orderBy(...byScore)
            .limit(query.limit)
        : await tx
            .select({ id: tracks.id })
            .from(albumTracks)
            .innerJoin(tracks, eq(albumTracks.trackId, tracks.id))
            .where(and(eligible, eq(albumTracks.albumId, source.albumId)))
            .orderBy(
              asc(albumTracks.discPosition),
              asc(albumTracks.trackPosition),
            )
            .limit(query.limit);
  return rows.map((row) => row.id);
};

/**
 * Whether the Artist or Album a source names exists. A genre names no row of
 * its own: it exists as far as its Tracks do, which the Track count decides.
 */
export const selectSourceExists = async (
  txHost: TransactionHost<DatabaseAdapter>,
  source: EditorialPinDynamicSource,
): Promise<boolean> => {
  if (source.type === 'genre') {
    return true;
  }
  const rows =
    source.type === 'artist'
      ? await txHost.tx
          .select({ id: artists.id })
          .from(artists)
          .where(eq(artists.id, source.artistId))
          .limit(1)
      : await txHost.tx
          .select({ id: albums.id })
          .from(albums)
          .where(eq(albums.id, source.albumId))
          .limit(1);
  return rows.length > 0;
};

/** A Track with what the pin picker shows to pick it. */
export type PinTrackRecord = {
  id: string;
  title: string;
  artistCredit: StoredArtistCreditEntry[];
  coverUrl: string | null;
};

const pinTrackColumns = {
  id: tracks.id,
  title: tracks.title,
  artistCredit: tracks.artistCredit,
  coverUrl: tracks.coverUrl,
};

/** Escapes the LIKE metacharacters of an admin search, so they match literally. */
const escapeLike = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');

/**
 * Completed Tracks matching `q` in the title or a credited name, hottest
 * first. A hero only offers Tracks with a cover.
 */
export const selectPinTrackSearch = async (
  txHost: TransactionHost<DatabaseAdapter>,
  query: { q: string; kind: EditorialPinKind | undefined; limit: number },
): Promise<PinTrackRecord[]> => {
  const pattern = `%${escapeLike(query.q)}%`;
  return txHost.tx
    .select(pinTrackColumns)
    .from(tracks)
    .where(
      and(
        hasCompletedProcessing(tracks.id),
        or(
          ilike(tracks.title, pattern),
          sql`${tracks.artistCredit}::text ILIKE ${pattern}`,
        ),
        query.kind === 'hero' ? isNotNull(tracks.coverUrl) : undefined,
      ),
    )
    .orderBy(desc(tracks.trendingScore), asc(tracks.id))
    .limit(query.limit);
};

/**
 * The completed Tracks among `ids` with what the picker shows, in the
 * requested order. Unknown or uncompleted IDs are left out, so the picker
 * can still name the ones it resolves.
 */
export const selectPinTracksByIds = async (
  txHost: TransactionHost<DatabaseAdapter>,
  ids: string[],
): Promise<PinTrackRecord[]> => {
  if (ids.length === 0) {
    return [];
  }
  const rows = await txHost.tx
    .select(pinTrackColumns)
    .from(tracks)
    .where(and(inArray(tracks.id, ids), hasCompletedProcessing(tracks.id)));
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.flatMap((id) => {
    const row = byId.get(id);
    return row ? [row] : [];
  });
};
