import { Injectable } from '@nestjs/common';
import type {
  ListUserAttemptsQuery,
  PracticeAttemptHistoryPage,
} from '@notefinder/contracts';
import { AppException } from '../../common/errors/app-exception.js';
import { UsersService } from '../users/users.service.js';
import { toPracticeAttempt } from './attempt-view.js';
import { AttemptsRepository } from './attempts.repository.js';
import {
  decodeOwnAttemptCursor,
  nextOwnAttemptCursor,
} from './own-attempt-cursor.js';

/**
 * The public practice history of a User, addressed by username. Anyone may
 * read it, so it carries nothing but the saved runs and the Track each one
 * was sung on.
 */
@Injectable()
export class UserAttemptsService {
  constructor(
    private readonly attempts: AttemptsRepository,
    private readonly users: UsersService,
  ) {}

  /**
   * One page of the User's runs, newest first. It is read on every request,
   * not cached under the profile tag: a run saved a moment ago must show on the
   * next visit, and saving a run does not revalidate the profile. Usernames are stored lowercase,
   * so any casing finds the History. An unknown username is `NOT_FOUND`; a
   * User with no runs gets an empty page.
   */
  async listHistory(
    username: string,
    query: ListUserAttemptsQuery,
  ): Promise<PracticeAttemptHistoryPage> {
    const userId = await this.users.findUserIdByUsername(username);
    if (userId === undefined) {
      throw new AppException('NOT_FOUND', 'User not found');
    }
    const rows = await this.attempts.listHistory({
      userId,
      after: query.cursor ? decodeOwnAttemptCursor(query.cursor) : undefined,
      // One more than asked tells whether another page follows.
      limit: query.limit + 1,
    });
    const page = rows.slice(0, query.limit);
    return {
      items: page.map(({ attempt, track }) => ({
        ...toPracticeAttempt(attempt),
        track,
      })),
      nextCursor: nextOwnAttemptCursor(
        page.at(-1)?.attempt,
        rows.length > query.limit,
      ),
    };
  }
}
