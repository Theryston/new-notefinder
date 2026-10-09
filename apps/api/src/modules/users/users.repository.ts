import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { CurrentUser, Locale } from '@notefinder/contracts';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import type { DatabaseAdapter } from '../../database/database.js';
import { users } from '../../database/schema/users.js';
import { isUniqueViolation } from '../../database/unique-violation.js';

export type CurrentUserRow = Omit<CurrentUser, 'createdAt'> & {
  createdAt: Date;
};

/** The fields other Users see of an account: no email, no role. */
export type PublicUserRow = {
  id: string;
  username: string | null;
  name: string;
  image: string | null;
};

/** The fields a notification email needs about a User: where it goes and in what language. */
export type EmailRecipientRow = {
  id: string;
  email: string;
  locale: Locale;
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

  /** Sets the language the User's emails follow. */
  async setLocale(id: string, locale: Locale): Promise<void> {
    await this.txHost.tx.update(users).set({ locale }).where(eq(users.id, id));
  }

  /** The email and language of the Users given, for the ones that exist. */
  async findEmailRecipients(ids: string[]): Promise<EmailRecipientRow[]> {
    if (ids.length === 0) {
      return [];
    }
    return this.txHost.tx
      .select({
        id: users.id,
        email: users.email,
        locale: users.locale,
      })
      .from(users)
      .where(inArray(users.id, ids));
  }

  /** The public fields of the Users given, for the ones that exist. */
  async findPublicUsers(ids: string[]): Promise<PublicUserRow[]> {
    if (ids.length === 0) {
      return [];
    }
    return this.txHost.tx
      .select({
        id: users.id,
        username: users.username,
        name: users.name,
        image: users.image,
      })
      .from(users)
      .where(inArray(users.id, ids));
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
