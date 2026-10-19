import { Module } from '@nestjs/common';
import { AttemptsModule } from '../attempts/attempts.module.js';
import { TracksModule } from '../tracks/tracks.module.js';
import { FavoritesController } from './favorites.controller.js';
import { FavoritesRepository } from './favorites.repository.js';
import { FavoritesService } from './favorites.service.js';
import { TrackStateService } from './track-state.service.js';

/** The Tracks a User favorited, and the per-User state of a Track. */
@Module({
  imports: [TracksModule, AttemptsModule],
  controllers: [FavoritesController],
  providers: [FavoritesService, FavoritesRepository, TrackStateService],
  exports: [FavoritesService],
})
export class FavoritesModule {}
