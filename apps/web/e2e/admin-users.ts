import type { MockUser } from './auth-api-mock';
import { messages } from './messages';

/** The admin tests sign in as. */
export const adminUser: MockUser = {
  id: 'usr_admin',
  name: 'Admin',
  email: 'admin@example.com',
  emailVerified: true,
  username: 'admin',
  image: null,
  createdAt: '2026-09-28T12:00:00.000Z',
  updatedAt: '2026-09-28T12:00:00.000Z',
  role: 'ADMIN',
};

/** A signed-in User without the admin role. */
export const regularUser: MockUser = {
  id: 'usr_ada',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  emailVerified: true,
  username: 'ada',
  image: null,
  createdAt: '2026-09-28T12:00:00.000Z',
  updatedAt: '2026-09-28T12:00:00.000Z',
};

/** Both locales with their message catalogs, for the admin specs. */
export const adminLocales = [
  { locale: 'en', copy: messages.en },
  { locale: 'pt-BR', copy: messages['pt-BR'] },
] as const;
