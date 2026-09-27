import { currentUserSchema } from '@notefinder/contracts';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { sessions } from '../src/database/schema/auth.js';
import { users } from '../src/database/schema/users.js';
import {
  type AuthClient,
  createAuthClient,
  SESSION_COOKIE,
  sessionCookieFrom,
  signIn,
} from './utils/auth.js';
import { createTestApp, type TestApp } from './utils/create-test-app.js';
import { resetDatabase } from './utils/database.js';
import {
  createCredentialAccount,
  createUser,
  DEFAULT_PASSWORD,
  type User,
} from './utils/factories.js';

const unauthorizedEnvelope = {
  statusCode: 401,
  code: 'UNAUTHORIZED',
  message: expect.any(String),
};

describe('GET /v1/me (e2e)', () => {
  let testApp: TestApp;
  let client: AuthClient;
  let user: User;
  let sessionCookie: string;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.close();
  });

  beforeEach(async () => {
    await resetDatabase(testApp.db);
    client = createAuthClient(testApp);
    user = await createUser(testApp.db, {
      name: 'Grace Hopper',
      email: 'grace@example.com',
      username: 'grace',
      image: 'https://example.com/grace.png',
    });
    await createCredentialAccount(testApp.db, user);
    const response = await signIn(client, {
      email: user.email,
      password: DEFAULT_PASSWORD,
    }).expect(200);
    const cookie = sessionCookieFrom(response);
    if (cookie === undefined) throw new Error('Sign-in set no session cookie');
    sessionCookie = cookie;
  });

  const anonymous = () => request(testApp.app.getHttpServer());

  it('returns the signed-in user, and only the contract fields', async () => {
    const response = await client.get('/v1/me').expect(200);

    expect(response.body).toEqual({
      id: user.id,
      name: 'Grace Hopper',
      email: 'grace@example.com',
      emailVerified: true,
      username: 'grace',
      image: 'https://example.com/grace.png',
      role: 'USER',
      createdAt: user.createdAt.toISOString(),
    });
    expect(currentUserSchema.parse(response.body)).toEqual(response.body);
    expect(Object.keys(response.body).sort()).toEqual(
      Object.keys(currentUserSchema.shape).sort(),
    );
  });

  it('reads fields changed after sign-in from the database', async () => {
    await testApp.db
      .update(users)
      .set({ role: 'ADMIN', username: 'rear_admiral' })
      .where(eq(users.id, user.id));

    const response = await client.get('/v1/me').expect(200);
    expect(response.body).toMatchObject({
      role: 'ADMIN',
      username: 'rear_admiral',
    });
  });

  it('works with the cookie forwarded by a server (no Origin)', async () => {
    await anonymous()
      .get('/v1/me')
      .set('Cookie', `${SESSION_COOKIE}=${sessionCookie}`)
      .expect(200);
  });

  it('returns the UNAUTHORIZED envelope without a cookie', async () => {
    const response = await anonymous().get('/v1/me').expect(401);
    expect(response.body).toEqual(unauthorizedEnvelope);
  });

  it.each([
    ['a made-up token', 'forged-token.forged-signature'],
    ['an unsigned token', 'not-a-signed-token'],
  ])('returns 401 for %s', async (_label, value) => {
    const response = await anonymous()
      .get('/v1/me')
      .set('Cookie', `${SESSION_COOKIE}=${value}`)
      .expect(401);
    expect(response.body).toEqual(unauthorizedEnvelope);
  });

  it('returns 401 for a real token with a tampered signature', async () => {
    const [token] = decodeURIComponent(sessionCookie).split('.');
    const tampered = encodeURIComponent(`${token}.${'A'.repeat(43)}=`);

    const response = await anonymous()
      .get('/v1/me')
      .set('Cookie', `${SESSION_COOKIE}=${tampered}`)
      .expect(401);
    expect(response.body).toEqual(unauthorizedEnvelope);
  });

  it('returns 401 once the session has expired', async () => {
    await testApp.db
      .update(sessions)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(sessions.userId, user.id));

    const response = await client.get('/v1/me').expect(401);
    expect(response.body).toEqual(unauthorizedEnvelope);
  });

  it('returns 401 once the user is deleted', async () => {
    await testApp.db.delete(users).where(eq(users.id, user.id));

    const response = await client.get('/v1/me').expect(401);
    expect(response.body).toEqual(unauthorizedEnvelope);
  });
});
