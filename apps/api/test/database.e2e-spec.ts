import { count, eq } from 'drizzle-orm';
import type { Database } from '../src/database/database.js';
import {
  accounts,
  sessions,
  verifications,
} from '../src/database/schema/auth.js';
import { users } from '../src/database/schema/users.js';
import { verifyPassword } from '../src/modules/auth/password.js';
import { connectTestDatabase, resetDatabase } from './utils/database.js';
import {
  createCredentialAccount,
  createPasswordUser,
  createUser,
  DEFAULT_PASSWORD,
} from './utils/factories.js';

// Covers the e2e database helpers themselves: migrations applied by the
// global setup, the factories and resetDatabase.
describe('E2E database helpers (e2e)', () => {
  let db: Database;
  let close: () => Promise<void>;

  beforeAll(() => {
    ({ db, close } = connectTestDatabase());
  });

  beforeEach(async () => {
    await resetDatabase(db);
  });

  afterAll(async () => {
    await close();
  });

  const countRows = async (
    table:
      | typeof users
      | typeof accounts
      | typeof sessions
      | typeof verifications,
  ): Promise<number> => {
    const [row] = await db.select({ value: count() }).from(table);
    return row?.value ?? 0;
  };

  it('creates users with deterministic defaults', async () => {
    const first = await createUser(db);
    const second = await createUser(db);

    expect(first).toMatchObject({
      name: 'User 1',
      email: 'user-1@example.com',
      emailVerified: true,
      username: 'user_1',
      role: 'USER',
    });
    expect(second).toMatchObject({ name: 'User 2', username: 'user_2' });
    expect(first.id).not.toBe(second.id);
  });

  it('applies overrides', async () => {
    const user = await createUser(db, {
      name: 'Grace',
      username: null,
      role: 'ADMIN',
    });

    expect(user).toMatchObject({
      name: 'Grace',
      username: null,
      role: 'ADMIN',
    });
  });

  it('gives credential accounts a scrypt hash of the default password', async () => {
    const user = await createPasswordUser(db);

    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.userId, user.id));

    expect(account).toMatchObject({
      providerId: 'credential',
      accountId: user.id,
    });
    const hash = account?.password ?? '';
    expect(hash).not.toMatch(/^\$2/);
    expect(await verifyPassword({ hash, password: DEFAULT_PASSWORD })).toBe(
      true,
    );
  });

  it('stores a legacy bcrypt hash when asked', async () => {
    const user = await createUser(db);

    const account = await createCredentialAccount(db, user, {
      password: 'legacy-secret',
      legacyBcrypt: true,
    });

    const hash = account.password ?? '';
    expect(hash).toMatch(/^\$2a\$/);
    expect(await verifyPassword({ hash, password: 'legacy-secret' })).toBe(
      true,
    );
  });

  it('resetDatabase empties every table and restarts the sequences', async () => {
    const user = await createPasswordUser(db);
    await db.insert(sessions).values({
      token: 'session-token',
      expiresAt: new Date(Date.now() + 60_000),
      userId: user.id,
    });
    await db.insert(verifications).values({
      identifier: 'email-verification-otp-user-1@example.com',
      value: '123456',
      expiresAt: new Date(Date.now() + 60_000),
    });

    await resetDatabase(db);

    for (const table of [users, accounts, sessions, verifications]) {
      expect(await countRows(table)).toBe(0);
    }
    expect(await createUser(db)).toMatchObject({ name: 'User 1' });
  });
});
