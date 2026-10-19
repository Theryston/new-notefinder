import { Module } from '@nestjs/common';
import { AttemptsModule } from '../attempts/attempts.module.js';
import { FavoritesModule } from '../favorites/favorites.module.js';
import { StreaksModule } from '../streaks/streaks.module.js';
import { TracksModule } from '../tracks/tracks.module.js';
import { UsersModule } from '../users/users.module.js';
import { ProfileSummaryController } from './profile-summary.controller.js';
import { ProfileSummaryService } from './profile-summary.service.js';

/** The Summary section of a public Profile, read through the owning modules. */
@Module({
  imports: [
    UsersModule,
    StreaksModule,
    AttemptsModule,
    FavoritesModule,
    TracksModule,
  ],
  controllers: [ProfileSummaryController],
  providers: [ProfileSummaryService],
})
export class ProfileSummaryModule {}
