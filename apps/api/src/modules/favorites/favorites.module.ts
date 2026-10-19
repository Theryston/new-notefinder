import { Module } from '@nestjs/common';
import { AttemptsModule } from '../attempts/attempts.module.js';
import { TracksModule } from '../tracks/tracks.module.js';
import { UsersModule } from '../users/users.module.js';
import { FavoritesController } from './favorites.controller.js';
import { FavoritesRepository } from './favorites.repository.js';
import { FavoritesService } from './favorites.service.js';
import { TrackStateService } from './track-state.service.js';
import { UserFavoritesController } from './user-favorites.controller.js';
import { UserFavoritesService } from './user-favorites.service.js';

/** The Tracks a User favorited, and the per-User state of a Track. */
@Module({
  imports: [TracksModule, AttemptsModule, UsersModule],
  controllers: [FavoritesController, UserFavoritesController],
  providers: [
    FavoritesService,
    FavoritesRepository,
    TrackStateService,
    UserFavoritesService,
  ],
})
export class FavoritesModule {}
