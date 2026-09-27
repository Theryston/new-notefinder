import { index, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { id, timestamps } from '../columns.js';
import { users } from './users.js';

// Better Auth's `session`, `account` and `verification` models. Columns keep
// Better Auth's field names so its Drizzle adapter can map them 1:1.

export const sessions = pgTable(
  'sessions',
  {
    id: id(),
    // Opaque session token; the signed cookie carries it.
    token: text().notNull().unique(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    ipAddress: text(),
    userAgent: text(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (table) => [index().on(table.userId)],
);

/**
 * Sign-in methods of a user: one row per OAuth provider account, plus a
 * `credential` row (`accountId` = user ID) holding the password hash.
 *
 * Legacy mapping: `users.password` becomes a `credential` row with the bcrypt
 * hash as-is (verified by `modules/auth/password.ts`). NextAuth accounts map
 * `provider` → `providerId`, `providerAccountId` → `accountId`,
 * `access_token`/`refresh_token`/`id_token`/`scope` as-is, and `expires_at`
 * (epoch seconds) → `accessTokenExpiresAt`; `type`, `token_type` and
 * `session_state` are NextAuth-only and dropped. Legacy has no account ID
 * (composite key), so imported rows get a new cuid2.
 */
export const accounts = pgTable(
  'accounts',
  {
    id: id(),
    providerId: text().notNull(),
    accountId: text().notNull(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: timestamp({ withTimezone: true }),
    refreshTokenExpiresAt: timestamp({ withTimezone: true }),
    scope: text(),
    password: text(),
    ...timestamps,
  },
  (table) => [
    // Legacy's primary key (provider, providerAccountId), so it always holds.
    unique('accounts_provider_id_account_id_unique').on(
      table.providerId,
      table.accountId,
    ),
    index().on(table.userId),
  ],
);

/**
 * Short-lived codes (email OTPs, OAuth state). Legacy verification and
 * password-reset codes expire in minutes and are not imported.
 */
export const verifications = pgTable(
  'verifications',
  {
    id: id(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => [index().on(table.identifier)],
);
