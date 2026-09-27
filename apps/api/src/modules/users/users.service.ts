import { Injectable } from '@nestjs/common';
import type { CurrentUser } from '@notefinder/contracts';
import { AppException } from '../../common/errors/app-exception.js';
import { UsersRepository } from './users.repository.js';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  /**
   * The signed-in user. Read from the database rather than the session so
   * fields changed since sign-in (username, role) are current.
   */
  async getCurrentUser(userId: string): Promise<CurrentUser> {
    const user = await this.usersRepository.findCurrentUser(userId);
    if (!user) {
      // The session outlived its user (deleted in between).
      throw new AppException('UNAUTHORIZED', 'User no longer exists');
    }
    return { ...user, createdAt: user.createdAt.toISOString() };
  }
}
