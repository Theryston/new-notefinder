import { Module } from '@nestjs/common';
import { AttemptsModule } from '../attempts/attempts.module.js';
import { FollowsModule } from '../follows/follows.module.js';
import { UsersModule } from '../users/users.module.js';
import { PublicProfileService } from './public-profile.service.js';
import { UserProfileController } from './user-profile.controller.js';

/** The public Profile page's data: the banner, its chips and follow counts. */
@Module({
  imports: [UsersModule, AttemptsModule, FollowsModule],
  controllers: [UserProfileController],
  providers: [PublicProfileService],
})
export class ProfilesModule {}
