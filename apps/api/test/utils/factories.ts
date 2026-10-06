import bcrypt from 'bcryptjs';
import type { Database } from '../../src/database/database.js';
import { accounts } from '../../src/database/schema/auth.js';
import { tracks } from '../../src/database/schema/tracks.js';
import { users } from '../../src/database/schema/users.js';
import { hashPassword } from '../../src/modules/auth/password.js';

export type User = typeof users.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Track = typeof tracks.$inferSelect;

type NewUser = typeof users.$inferInsert;
type NewTrack = typeof tracks.$inferInsert;

// Per-entity counters make default values unique and predictable within a
// spec ("User 1", "User 2", …). `resetDatabase` restarts them.
const sequences = new Map<string, number>();

const next = (entity: string): number => {
  const value = (sequences.get(entity) ?? 0) + 1;
  sequences.set(entity, value);
  return value;
};

export const resetFactorySequences = (): void => {
  sequences.clear();
};

const insertOne = async <T>(rows: Promise<T[]>): Promise<T> => {
  const [row] = await rows;
  if (row === undefined) {
    throw new Error('Insert returned no row');
  }
  return row;
};

/** Password every factory-made credential account gets by default. */
export const DEFAULT_PASSWORD = 'correct-horse-battery';

/** A verified user (`user-1@example.com`, `user_1`) without sign-in methods. */
export const createUser = (
  db: Database,
  overrides: Partial<NewUser> = {},
): Promise<User> => {
  const n = next('user');
  return insertOne(
    db
      .insert(users)
      .values({
        name: `User ${n}`,
        email: `user-${n}@example.com`,
        emailVerified: true,
        username: `user_${n}`,
        ...overrides,
      })
      .returning(),
  );
};

export type CreateCredentialAccountOptions = {
  /** Defaults to {@link DEFAULT_PASSWORD}. */
  password?: string;
  /**
   * Stores a `$2a$` bcrypt hash, like the accounts imported from the legacy
   * app, instead of Better Auth's scrypt.
   */
  legacyBcrypt?: boolean;
};

// bcryptjs only generates `$2b$`; legacy hashes are `$2a$`, the same
// algorithm under the older prefix (bcryptjs verifies both).
const legacyBcryptHash = async (password: string): Promise<string> =>
  (await bcrypt.hash(password, 4)).replace(/^\$2b\$/, '$2a$');

/** The email/password sign-in method of a user (Better Auth `credential`). */
export const createCredentialAccount = async (
  db: Database,
  user: User,
  options: CreateCredentialAccountOptions = {},
): Promise<Account> => {
  const password = options.password ?? DEFAULT_PASSWORD;
  return insertOne(
    db
      .insert(accounts)
      .values({
        providerId: 'credential',
        accountId: user.id,
        userId: user.id,
        password: options.legacyBcrypt
          ? await legacyBcryptHash(password)
          : await hashPassword(password),
      })
      .returning(),
  );
};

/** A {@link createUser} who can sign in with {@link DEFAULT_PASSWORD}. */
export const createPasswordUser = async (
  db: Database,
  overrides: Partial<NewUser> = {},
): Promise<User> => {
  const user = await createUser(db, overrides);
  await createCredentialAccount(db, user);
  return user;
};

/** Deterministic version-4 UUIDs for seeded recording references. */
export const testMbid = (n: number): string =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** A processed Track for the n-th test Recording (`testMbid(n)`). */
export const createTrack = (
  db: Database,
  overrides: Partial<NewTrack> = {},
): Promise<Track> => {
  const n = next('track');
  return insertOne(
    db
      .insert(tracks)
      .values({ recordingMbid: testMbid(n), ...overrides })
      .returning(),
  );
};
