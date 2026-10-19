import { Injectable, Logger } from '@nestjs/common';
import { cacheTags } from '@notefinder/contracts';
import { WebRevalidationService } from '../../integrations/web-revalidation/web-revalidation.service.js';
import { UsersService } from '../users/users.service.js';
import { FavoritesService } from './favorites.service.js';

/**
 * Saves a User's favorite changes and tells the web to refresh the favorite
 * songs of the User's Profile, which the web caches under its own tag. The
 * revalidation is best effort: the change is already saved, so a queue that
 * is down must not turn the write into an error.
 */
@Injectable()
export class FavoriteWritesService {
  private readonly logger = new Logger(FavoriteWritesService.name);

  constructor(
    private readonly favorites: FavoritesService,
    private readonly users: UsersService,
    private readonly webRevalidation: WebRevalidationService,
  ) {}

  async add(userId: string, trackId: string): Promise<void> {
    await this.favorites.add(userId, trackId);
    await this.revalidateFavorites(userId);
  }

  async remove(userId: string, trackId: string): Promise<void> {
    await this.favorites.remove(userId, trackId);
    await this.revalidateFavorites(userId);
  }

  private async revalidateFavorites(userId: string): Promise<void> {
    try {
      const { username } = await this.users.getCurrentUser(userId);
      // Without a username there is no Profile, so nothing is cached for it.
      if (username) {
        await this.webRevalidation.revalidate([
          cacheTags.userFavorites(username),
        ]);
      }
    } catch (error) {
      this.logger.warn(
        `Could not enqueue the favorites revalidation: ${reasonOf(error)}`,
      );
    }
  }
}

const reasonOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
