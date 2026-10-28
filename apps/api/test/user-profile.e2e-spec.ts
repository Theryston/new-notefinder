import { publicProfileSchema } from '@vozzify/contracts';
import { createTestApp, type TestApp } from './utils/create-test-app.js';
import { resetDatabase } from './utils/database.js';
import { createUser } from './utils/factories.js';

// Public Profile banner over a real Postgres: the contracted shape with no
// private fields, the case-insensitive username lookup, and a real 404 for
// an unknown username.
describe('GET /v1/users/:username (e2e)', () => {
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

  it('returns only the banner fields of the User', async () => {
    const user = await createUser(testApp.db, {
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      username: 'ada_lovelace',
    });

    const response = await testApp.http
      .get('/v1/users/ada_lovelace')
      .expect(200);

    expect(publicProfileSchema.parse(response.body)).toEqual(response.body);
    expect(response.body).toEqual({
      username: 'ada_lovelace',
      name: 'Ada Lovelace',
      image: user.image,
      createdAt: expect.any(String),
      dailyPracticeTargetSeconds: null,
      vocalRange: null,
      mostSungArtist: null,
      followersCount: 0,
      followingCount: 0,
      friendsCount: 0,
    });
    expect(response.body).not.toHaveProperty('email');
    expect(response.body).not.toHaveProperty('id');
  });

  it('finds the Profile whatever the casing of the username', async () => {
    await createUser(testApp.db, {
      name: 'Grace Hopper',
      email: 'grace@example.com',
      username: 'grace',
    });

    const response = await testApp.http.get('/v1/users/GRACE').expect(200);

    expect(response.body).toMatchObject({ username: 'grace' });
  });

  it('answers NOT_FOUND for a username no User has', async () => {
    const response = await testApp.http.get('/v1/users/nobody').expect(404);

    expect(response.body).toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
  });
});
