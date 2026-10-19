import { Injectable } from '@nestjs/common';
import type {
  PracticeAttempt,
  SubmitPracticeAttemptBody,
} from '@notefinder/contracts';
import { UsersService } from '../users/users.service.js';
import { AttemptsService } from './attempts.service.js';

/**
 * Saves a practice run and refreshes the User's public Profile, whose Vocal
 * range and Most sung artist chips the run may change. The controller calls
 * this, so the saving rules stay in `AttemptsService` and the cache refresh is
 * a separate step that only runs after a run was saved.
 */
@Injectable()
export class SubmitAttemptService {
  constructor(
    private readonly attempts: AttemptsService,
    private readonly users: UsersService,
  ) {}

  async submit(
    userId: string,
    trackId: string,
    body: SubmitPracticeAttemptBody,
  ): Promise<PracticeAttempt> {
    const attempt = await this.attempts.submitAttempt(userId, trackId, body);
    await this.users.revalidatePublicProfile(userId);
    return attempt;
  }
}
