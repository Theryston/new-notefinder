import { Module } from '@nestjs/common';
import { TracksModule } from '../tracks/tracks.module.js';
import { UsersModule } from '../users/users.module.js';
import { AttemptsRepository } from './attempts.repository.js';
import { AttemptsService } from './attempts.service.js';
import { MyAttemptsController } from './my-attempts.controller.js';
import { SubmitAttemptService } from './submit-attempt.service.js';
import { TrackAttemptsController } from './track-attempts.controller.js';

/** A signed-in User's saved practice runs and their own history. */
@Module({
  imports: [TracksModule, UsersModule],
  controllers: [TrackAttemptsController, MyAttemptsController],
  providers: [AttemptsService, AttemptsRepository, SubmitAttemptService],
  exports: [AttemptsService],
})
export class AttemptsModule {}
