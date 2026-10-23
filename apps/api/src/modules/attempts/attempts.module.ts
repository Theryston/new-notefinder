import { Module } from '@nestjs/common';
import { HomeModule } from '../home/home.module.js';
import { TracksModule } from '../tracks/tracks.module.js';
import { UsersModule } from '../users/users.module.js';
import { AttemptsRepository } from './attempts.repository.js';
import { AttemptsService } from './attempts.service.js';
import { AttemptsProfileModule } from './attempts-profile.module.js';
import { MyAttemptsController } from './my-attempts.controller.js';
import { SubmitAttemptService } from './submit-attempt.service.js';
import { TrackAttemptsController } from './track-attempts.controller.js';
import { UserAttemptsController } from './user-attempts.controller.js';
import { UserAttemptsService } from './user-attempts.service.js';

/** A signed-in User's saved practice runs and their own history. */
@Module({
  imports: [TracksModule, UsersModule, HomeModule, AttemptsProfileModule],
  controllers: [
    TrackAttemptsController,
    MyAttemptsController,
    UserAttemptsController,
  ],
  providers: [
    AttemptsService,
    AttemptsRepository,
    SubmitAttemptService,
    UserAttemptsService,
  ],
  exports: [AttemptsService],
})
export class AttemptsModule {}
