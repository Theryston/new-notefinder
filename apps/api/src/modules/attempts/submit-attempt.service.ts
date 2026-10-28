import { Injectable } from '@nestjs/common';
import type {
  PracticeAttempt,
  SubmitPracticeAttemptBody,
} from '@vozzify/contracts';
import { LOCALES, type Locale } from '@vozzify/contracts';
import { PersonalHomeQueueService } from '../home/home-personal-queue.service.js';
import { UsersService } from '../users/users.service.js';
import { AttemptsService } from './attempts.service.js';

/**
 * Saves a practice run and refreshes the User's public Profile, whose Vocal
 * range and Most sung artist chips the run may change. The controller calls
 * this, so the saving rules stay in `AttemptsService` and the cache refresh is
 * a separate step that only runs after a run was saved. The run also changes
 * the User's personal home feed, so a debounced snapshot rebuild is scheduled
 * for every locale: the request carries none.
 */
@Injectable()
export class SubmitAttemptService {
  constructor(
    private readonly attempts: AttemptsService,
    private readonly users: UsersService,
    private readonly personalRefresh: PersonalHomeQueueService,
  ) {}

  async submit(
    userId: string,
    trackId: string,
    body: SubmitPracticeAttemptBody,
  ): Promise<PracticeAttempt> {
    const attempt = await this.attempts.submitAttempt(userId, trackId, body);
    await this.users.revalidatePublicProfile(userId);
    await this.schedulePersonalRefresh(userId);
    return attempt;
  }

  private async schedulePersonalRefresh(userId: string): Promise<void> {
    await Promise.all(
      LOCALES.map((locale: Locale) =>
        this.personalRefresh.scheduleRefresh(userId, locale),
      ),
    );
  }
}
