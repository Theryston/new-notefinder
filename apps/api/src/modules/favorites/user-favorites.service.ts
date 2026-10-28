import { Injectable } from '@nestjs/common';
import type { UserFavoritesPage } from '@vozzify/contracts';
import { TracksService } from '../tracks/tracks.service.js';
import { UserProfileService } from '../users/user-profile.service.js';
import {
  decodeFavoriteCursor,
  encodeFavoriteCursor,
} from './favorite-cursor.js';
import { FavoritesRepository } from './favorites.repository.js';

/**
 * The favorite Tracks a visitor sees on a User's Profile, read by username.
 * The Profile service answers `NOT_FOUND` for an unknown username, so an
 * empty listing is always a real, existing User with no favorites.
 */
@Injectable()
export class UserFavoritesService {
  constructor(
    private readonly favorites: FavoritesRepository,
    private readonly tracks: TracksService,
    private readonly profiles: UserProfileService,
  ) {}

  /**
   * One cursor page of the User's favorites, newest favorited first. Usernames
   * are stored lowercase, so any casing finds the same favorites.
   */
  async listPage(
    username: string,
    query: { cursor?: string; limit: number },
  ): Promise<UserFavoritesPage> {
    const normalized = username.toLowerCase();
    await this.profiles.getPublicProfile(normalized);
    const after = query.cursor ? decodeFavoriteCursor(query.cursor) : undefined;
    const rows = await this.favorites.findPageByUsername(normalized, {
      after: after && {
        favoritedAt: new Date(after.favoritedAt),
        id: after.favoriteId,
      },
      limit: query.limit,
    });
    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    const last = page.at(-1);
    return {
      items: await this.tracks.getCatalogTracks(page.map((row) => row.trackId)),
      nextCursor:
        hasMore && last
          ? encodeFavoriteCursor({
              favoritedAt: last.favoritedAt.toISOString(),
              favoriteId: last.id,
            })
          : null,
    };
  }
}
