import type { Database } from '../../src/database/database.js';
import { type AuthClient, signIn } from './auth.js';
import {
  createCredentialAccount,
  createUser,
  DEFAULT_PASSWORD,
} from './factories.js';

/** Creates an admin and signs the client in as them. */
export const signInPinsAdmin = async (db: Database, client: AuthClient) => {
  const admin = await createUser(db, {
    role: 'ADMIN',
    name: 'Ada Admin',
    username: 'pins-admin',
    email: 'pins-admin@example.com',
  });
  await createCredentialAccount(db, admin);
  await signIn(client, {
    email: admin.email,
    password: DEFAULT_PASSWORD,
  }).expect(200);
  return admin;
};

/** The body of a row pin of specific Tracks, as the admin API takes it. */
export const rowPinBody = (
  trackIds: string[],
  overrides: Record<string, unknown> = {},
) => ({
  kind: 'row',
  layout: 'standard',
  source: { type: 'tracks', trackIds },
  position: 1,
  titles: { en: 'Festive', 'pt-BR': 'Festivo' },
  ...overrides,
});

/** The body of a hero pin on one Track, as the admin API takes it. */
export const heroPinBody = (
  trackId: string,
  overrides: Record<string, unknown> = {},
) => rowPinBody([trackId], { kind: 'hero', layout: 'hero', ...overrides });
