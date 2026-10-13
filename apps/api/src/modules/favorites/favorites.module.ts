import { Module } from '@nestjs/common';
import { TracksModule } from '../tracks/tracks.module.js';
import { FavoritesController } from './favorites.controller.js';
import { FavoritesRepository } from './favorites.repository.js';
import { FavoritesService } from './favorites.service.js';

/** The Tracks a User favorited, and the per-User state of a Track. */
@Module({
  imports: [TracksModule],
  controllers: [FavoritesController],
  providers: [FavoritesService, FavoritesRepository],
})
export class FavoritesModule {}
