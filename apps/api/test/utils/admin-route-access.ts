import request from 'supertest';
import { expect } from 'vitest';

import type { AuthClient } from './auth.js';
import { signIn } from './auth.js';
import type { TestApp } from './create-test-app.js';
import {
  createCredentialAccount,
  createUser,
  DEFAULT_PASSWORD,
} from './factories.js';

/**
 * The 401/403 answers of an admin-only route: a visitor is refused, and so
 * is a signed-in User who is not an admin.
 */
export async function expectAdminRouteAccess(
  testApp: TestApp,
  client: AuthClient,
  path: string,
): Promise<void> {
  await request(testApp.app.getHttpServer()).get(path).expect(401);

  const user = await createUser(testApp.db, {
    username: 'plain-user',
    email: 'plain-user@example.com',
  });
  await createCredentialAccount(testApp.db, user);
  await signIn(client, {
    email: user.email,
    password: DEFAULT_PASSWORD,
  }).expect(200);

  const response = await client.get(path).expect(403);
  expect(response.body).toMatchObject({ code: 'FORBIDDEN' });
}
