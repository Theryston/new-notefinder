import { createAuthClient, signIn } from './utils/auth.js';
import { createTestApp, type TestApp } from './utils/create-test-app.js';
import { resetDatabase } from './utils/database.js';
import { createPasswordUser, DEFAULT_PASSWORD } from './utils/factories.js';

describe('direct audio request validation (e2e)', () => {
  let testApp: TestApp;
  beforeAll(async () => {
    testApp = await createTestApp();
  });
  afterAll(async () => {
    await testApp.close();
  });
  beforeEach(async () => {
    await resetDatabase(testApp.db);
  });

  it('returns 400 VALIDATION_FAILED for an admin requesting an oversized Track ID', async () => {
    const admin = await createPasswordUser(testApp.db, { role: 'ADMIN' });
    const client = createAuthClient(testApp);
    await signIn(client, { email: admin.email, password: DEFAULT_PASSWORD });

    const response = await client
      .get(`/v1/tracks/${'a'.repeat(129)}/audio`)
      .expect(400);

    expect(response.body).toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      details: { location: 'param' },
    });
    expect(JSON.stringify(response.body)).not.toContain('.mp3');
  });
});
