import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { and, count, desc, eq, lt, or, sql } from 'drizzle-orm';
import type { DatabaseAdapter } from '../../database/database.js';
import { trackFavorites } from '../../database/schema/track-favorites.js';
import { hasCompletedProcessing } from '../../database/schema/track-processings.js';
import { users } from '../../database/schema/users.js';

/** One favorite of a User, as the public listing pages it. */
export type FavoritePageRow = {
  id: string;
  trackId: string;
  favoritedAt: Date;
};

/** The favorite a listing resumes after: its time (in ms) and its ID. */
export type FavoritePosition = {
  favoritedAt: Date;
  id: string;
};

// The listing orders and compares at milliseconds, the precision JS dates
// carry, so a cursor built from a row resumes exactly after that row.
// Decoded like the column itself, so the driver's string becomes a `Date`.
const favoritedAtMs =
  sql<Date>`date_trunc('milliseconds', ${trackFavorites.createdAt})`.mapWith(
    trackFavorites.createdAt,
  );

/** The favorites that come after `position` in newest-first order. */
const olderThan = (position: FavoritePosition) =>
  or(
    lt(favoritedAtMs, position.favoritedAt),
    and(
      eq(favoritedAtMs, position.favoritedAt),
      lt(trackFavorites.id, position.id),
    ),
  );

@Injectable()
export class FavoritesRepository {
  constructor(private readonly txHost: TransactionHost<DatabaseAdapter>) {}

  /**
   * One page of a User's favorites, newest favorited first, looked up by
   * username. Only Tracks with a completed Processing are listed (ADR 0005),
   * and `limit + 1` rows are read so the caller can tell whether more follow.
   */
  findPageByUsername(
    username: string,
    options: { after?: FavoritePosition; limit: number },
  ): Promise<FavoritePageRow[]> {
    const { after, limit } = options;
    return this.txHost.tx
      .select({
        id: trackFavorites.id,
        trackId: trackFavorites.trackId,
        favoritedAt: favoritedAtMs,
      })
      .from(trackFavorites)
      .innerJoin(users, eq(users.id, trackFavorites.userId))
      .where(
        and(
          eq(users.username, username),
          hasCompletedProcessing(trackFavorites.trackId),
          after ? olderThan(after) : undefined,
        ),
      )
      .orderBy(desc(favoritedAtMs), desc(trackFavorites.id))
      .limit(limit + 1);
  }

  /** Adds the favorite; a Track already in the favorites is left as it is. */
  async add(userId: string, trackId: string): Promise<void> {
    await this.txHost.tx
      .insert(trackFavorites)
      .values({ userId, trackId })
      .onConflictDoNothing({
        target: [trackFavorites.userId, trackFavorites.trackId],
      });
  }

  async remove(userId: string, trackId: string): Promise<void> {
    await this.txHost.tx
      .delete(trackFavorites)
      .where(
        and(
          eq(trackFavorites.userId, userId),
          eq(trackFavorites.trackId, trackId),
        ),
      );
  }

  /** How many Tracks the User marked as favorites. */
  async countOf(userId: string): Promise<number> {
    const [row] = await this.txHost.tx
      .select({ value: count() })
      .from(trackFavorites)
      .where(eq(trackFavorites.userId, userId));
    return row?.value ?? 0;
  }

  async isFavorite(userId: string, trackId: string): Promise<boolean> {
    const [row] = await this.txHost.tx
      .select({ id: trackFavorites.id })
      .from(trackFavorites)
      .where(
        and(
          eq(trackFavorites.userId, userId),
          eq(trackFavorites.trackId, trackId),
        ),
      )
      .limit(1);
    return row !== undefined;
  }
}
