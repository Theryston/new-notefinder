import { Injectable, Logger } from '@nestjs/common';
import { cacheTags, LOCALES, type Locale } from '@vozzify/contracts';
import { WebRevalidationService } from '../../integrations/web-revalidation/web-revalidation.service.js';
import { PersonalHomeQueueService } from '../home/home-personal-queue.service.js';
import { UsersService } from '../users/users.service.js';
import { FavoritesService } from './favorites.service.js';

/**
 * Saves a User's favorite changes and tells the web to refresh the favorite
 * songs of the User's Profile, which the web caches under its own tag. The
 * revalidation is best effort: the change is already saved, so a queue that
 * is down must not turn the write into an error. The favorite also changes
 * the User's personal home feed, so a debounced snapshot rebuild is scheduled
 * for every locale: the request carries none.
 */
@Injectable()
export class FavoriteWritesService {
  private readonly logger = new Logger(FavoriteWritesService.name);

  constructor(
    private readonly favorites: FavoritesService,
    private readonly users: UsersService,
    private readonly webRevalidation: WebRevalidationService,
    private readonly personalRefresh: PersonalHomeQueueService,
  ) {}

  async add(userId: string, trackId: string): Promise<void> {
    await this.favorites.add(userId, trackId);
    await this.revalidateFavorites(userId);
    await this.schedulePersonalRefresh(userId);
  }

  async remove(userId: string, trackId: string): Promise<void> {
    await this.favorites.remove(userId, trackId);
    await this.revalidateFavorites(userId);
    await this.schedulePersonalRefresh(userId);
  }

  private async schedulePersonalRefresh(userId: string): Promise<void> {
    await Promise.all(
      LOCALES.map((locale: Locale) =>
        this.personalRefresh.scheduleRefresh(userId, locale),
      ),
    );
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
