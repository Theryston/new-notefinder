import { Module } from '@nestjs/common';
import { AttemptsModule } from '../attempts/attempts.module.js';
import { UsersModule } from '../users/users.module.js';
import { PublicProfileService } from './public-profile.service.js';
import { UserProfileController } from './user-profile.controller.js';

/** The public Profile page's data: the banner and its chips, by username. */
@Module({
  imports: [UsersModule, AttemptsModule],
  controllers: [UserProfileController],
  providers: [PublicProfileService],
})
export class ProfilesModule {}
