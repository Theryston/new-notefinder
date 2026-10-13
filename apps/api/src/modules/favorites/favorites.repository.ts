import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { and, eq } from 'drizzle-orm';
import type { DatabaseAdapter } from '../../database/database.js';
import { trackFavorites } from '../../database/schema/track-favorites.js';

@Injectable()
export class FavoritesRepository {
  constructor(private readonly txHost: TransactionHost<DatabaseAdapter>) {}

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
