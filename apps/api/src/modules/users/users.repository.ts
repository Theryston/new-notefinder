import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { CurrentUser } from '@notefinder/contracts';
import { and, eq, isNull } from 'drizzle-orm';
import type { DatabaseAdapter } from '../../database/database.js';
import { users } from '../../database/schema/users.js';
import { isUniqueViolation } from '../../database/unique-violation.js';

export type CurrentUserRow = Omit<CurrentUser, 'createdAt'> & {
  createdAt: Date;
};

// Named in migration 0000_init.
const USERNAME_UNIQUE_CONSTRAINT = 'users_username_unique';

const currentUserColumns = {
  id: users.id,
  name: users.name,
  email: users.email,
  emailVerified: users.emailVerified,
  username: users.username,
  image: users.image,
  role: users.role,
  createdAt: users.createdAt,
};

type SetUsernameResult =
  | { status: 'set'; user: CurrentUserRow }
  // Another user has it.
  | { status: 'taken' }
  // No row matched: the user already has a username, or is gone.
  | { status: 'not-updated' };

@Injectable()
export class UsersRepository {
  constructor(private readonly txHost: TransactionHost<DatabaseAdapter>) {}

  async findCurrentUser(id: string): Promise<CurrentUserRow | undefined> {
    const [row] = await this.txHost.tx
      .select(currentUserColumns)
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return row;
  }

  /** Sets the Name and returns the updated user, or nothing when gone. */
  updateName(id: string, name: string): Promise<CurrentUserRow | undefined> {
    return this.updateProfile(id, { name });
  }

  /**
   * Sets the Name and the Avatar's URL in one statement, so the two are
   * never saved apart.
   */
  updateNameAndImage(
    id: string,
    name: string,
    image: string,
  ): Promise<CurrentUserRow | undefined> {
    return this.updateProfile(id, { name, image });
  }

  private async updateProfile(
    id: string,
    values: Pick<typeof users.$inferInsert, 'name' | 'image'>,
  ): Promise<CurrentUserRow | undefined> {
    const [row] = await this.txHost.tx
      .update(users)
      .set(values)
      .where(eq(users.id, id))
      .returning(currentUserColumns);
    return row;
  }

  /**
   * Sets the username only while it is null, in one statement, so two
   * concurrent requests can't both succeed and a set username never changes.
   */
  async setUsernameIfUnset(
    id: string,
    username: string,
  ): Promise<SetUsernameResult> {
    try {
      const [row] = await this.txHost.tx
        .update(users)
        .set({ username })
        .where(and(eq(users.id, id), isNull(users.username)))
        .returning(currentUserColumns);
      return row ? { status: 'set', user: row } : { status: 'not-updated' };
    } catch (error) {
      if (isUniqueViolation(error, USERNAME_UNIQUE_CONSTRAINT)) {
        return { status: 'taken' };
      }
      throw error;
    }
  }
}
