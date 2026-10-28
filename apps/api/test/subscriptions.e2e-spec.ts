import { createAuthClient, signIn } from './utils/auth.js';
import { createTestApp, type TestApp } from './utils/create-test-app.js';
import { resetDatabase } from './utils/database.js';
import {
  createCredentialAccount,
  createUser,
  DEFAULT_PASSWORD,
} from './utils/factories.js';

describe('Private subscription checkout (e2e)', () => {
  let app: TestApp;
  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(async () => {
    await resetDatabase(app.db);
  });
  it('requires authentication and reports no paid contract for a new User', async () => {
    await app.http.get('/v1/me/subscription').expect(401);
    const user = await createUser(app.db);
    await createCredentialAccount(app.db, user);
    const client = createAuthClient(app);
    await signIn(client, {
      email: user.email,
      password: DEFAULT_PASSWORD,
    }).expect(200);
    const response = await client.get('/v1/me/subscription').expect(200);
    expect(response.body).toEqual({ subscription: null });
    expect(response.headers['cache-control']).toBe('private, no-store');
  });
});
