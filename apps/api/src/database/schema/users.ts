import { boolean, integer, pgEnum, pgTable, text } from 'drizzle-orm/pg-core';
import { id, timestamps } from '../columns.js';

// Same values as the legacy Prisma `Role` enum, so the import copies them.
export const userRole = pgEnum('user_role', ['USER', 'ADMIN']);

/**
 * Better Auth's `user` model plus notefinder's own fields. Better Auth reads
 * and writes this table through the Drizzle adapter, so the core columns keep
 * its field names (see `modules/auth/auth.ts`).
 *
 * Legacy mapping: `name` is nullable in legacy but required here (the import
 * falls back to the username, then the email's local part), emails are
 * lowercased (Better Auth looks them up lowercased), and the `emailVerified`
 * timestamp becomes a boolean (`true` when set, or when the user has a Google
 * account, which legacy treated as verified).
 */
export const users = pgTable('users', {
  id: id(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean().notNull().default(false),
  image: text(),
  // Lowercase, unique when set. Null until an OAuth user picks one on the
  // "setup username" step.
  username: text().unique(),
  role: userRole().notNull().default('USER'),
  dailyPracticeTargetSeconds: integer(),
  ...timestamps,
});
