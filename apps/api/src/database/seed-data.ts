import type { users } from './schema/users.js';

/**
 * Deterministic development data for `db:seed`. Everything here is pure (no
 * database access) so it can be unit tested; `seed.ts` writes it. It grows
 * with the features that add tables.
 */

type UserRow = typeof users.$inferInsert & { id: string };

/**
 * The development user. `seed.ts` also gives it a password
 * (`SEED_USER_PASSWORD`), so developers can sign in right after seeding.
 */
export const SEED_USER = {
  id: 'seeduser01',
  name: 'Seed Creator',
  email: 'seed@notefinder.dev',
  emailVerified: true,
  username: 'seed_creator',
  role: 'USER',
} satisfies UserRow;

// Development only: `assertSeedAllowed` keeps the seed away from production.
export const SEED_USER_PASSWORD = 'notefinder-seed';

/** The seed writes fake data, so it must never touch a production database. */
export const assertSeedAllowed = (nodeEnv: string): void => {
  if (nodeEnv === 'production') {
    throw new Error('Refusing to seed the database when NODE_ENV=production');
  }
};
