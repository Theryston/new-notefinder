import { Module } from '@nestjs/common';
import { AttemptsRepository } from './attempts.repository.js';
import { AttemptsProfileService } from './attempts-profile.service.js';

/** Dependency-free Profile range reads shared by attempts and batch generators. */
@Module({
  providers: [AttemptsRepository, AttemptsProfileService],
  exports: [AttemptsProfileService],
})
export class AttemptsProfileModule {}
