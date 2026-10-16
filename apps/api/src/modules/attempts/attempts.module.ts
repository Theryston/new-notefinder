import { Module } from '@nestjs/common';
import { TracksModule } from '../tracks/tracks.module.js';
import { AttemptsRepository } from './attempts.repository.js';
import { AttemptsService } from './attempts.service.js';
import { MyAttemptsController } from './my-attempts.controller.js';
import { TrackAttemptsController } from './track-attempts.controller.js';

/** A signed-in User's saved practice runs and their own history. */
@Module({
  imports: [TracksModule],
  controllers: [TrackAttemptsController, MyAttemptsController],
  providers: [AttemptsService, AttemptsRepository],
  exports: [AttemptsService],
})
export class AttemptsModule {}
