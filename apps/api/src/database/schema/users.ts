import { LOCALES } from '@notefinder/contracts';
import { boolean, integer, pgEnum, pgTable, text } from 'drizzle-orm/pg-core';
import { id, timestamps } from '../columns.js';

// Same values as the legacy Prisma `Role` enum, so the import copies them.
export const userRole = pgEnum('user_role', ['USER', 'ADMIN']);

// The languages of the web app and the emails (`en` is the source of truth).
export const userLocale = pgEnum('user_locale', LOCALES);

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
  // The language the User browses in, which their emails follow. Sign-up sets
  // it from the request language (`modules/auth/sign-up-locale.ts`), and a
  // Track request or retry updates it from the locale the web sends.
  // Legacy import: legacy users have no locale of their own, so the import
  // keeps this default and every imported user gets `pt-BR`, the language the
  // legacy app was written in.
  locale: userLocale().notNull().default('pt-BR'),
  dailyPracticeTargetSeconds: integer(),
  ...timestamps,
});
