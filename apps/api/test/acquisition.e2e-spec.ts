import { eq } from 'drizzle-orm';
import request from 'supertest';
import { events } from '../src/database/schema/events.js';
import { userAcquisitions } from '../src/database/schema/user-acquisitions.js';
import { users } from '../src/database/schema/users.js';
import { type AuthClient, createAuthClient, signIn } from './utils/auth.js';
import { createTestApp, type TestApp } from './utils/create-test-app.js';
import { resetDatabase } from './utils/database.js';
import {
  createCredentialAccount,
  createUser,
  DEFAULT_PASSWORD,
  type User,
} from './utils/factories.js';

describe('POST /v1/me/acquisition (e2e)', () => {
  let testApp: TestApp;
  let client: AuthClient;
  let user: User;

  const body = {
    visitorId: 'visitor-1',
    firstTouch: { utmSource: 'newsletter', landingPath: '/' },
    lastTouch: { fbclid: 'click-2', landingPath: '/tracks/track-1' },
  };

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.close();
  });

  beforeEach(async () => {
    await resetDatabase(testApp.db);
    client = createAuthClient(testApp);
    user = await createUser(testApp.db);
    await createCredentialAccount(testApp.db, user);
    await signIn(client, {
      email: user.email,
      password: DEFAULT_PASSWORD,
    }).expect(200);
  });

  it('stores campaign touches once and connects earlier events by visitor id', async () => {
    const response = await client
      .post('/v1/me/acquisition')
      .send(body)
      .expect(201);

    expect(response.body).toEqual({ recorded: true });
    expect(await testApp.db.select().from(userAcquisitions)).toMatchObject([
      {
        userId: user.id,
        firstTouch: body.firstTouch,
        lastTouch: body.lastTouch,
      },
    ]);
    const [updated] = await testApp.db
      .select({ visitorId: users.visitorId })
      .from(users);
    expect(updated?.visitorId).toBe(body.visitorId);

    await testApp.db.insert(events).values({
      visitorId: body.visitorId,
      type: 'home.item_click',
      payload: { type: 'home.item_click' },
    });
    const joined = await testApp.db
      .select({ userId: users.id })
      .from(events)
      .innerJoin(users, eq(events.visitorId, users.visitorId));
    expect(joined).toEqual([{ userId: user.id }]);

    await client.post('/v1/me/acquisition').send(body).expect(409);
    expect(await testApp.db.select().from(userAcquisitions)).toHaveLength(1);
  });

  it('allows a fresh Google user before they choose a username', async () => {
    await testApp.db.update(users).set({ username: null });

    await client.post('/v1/me/acquisition').send(body).expect(201);
  });

  it('refuses an account older than the sign-up window', async () => {
    await testApp.db
      .update(users)
      .set({ createdAt: new Date(Date.now() - 31 * 60 * 1000) });

    await client
      .post('/v1/me/acquisition')
      .send(body)
      .expect(403)
      .expect(({ body: error }) => expect(error.code).toBe('FORBIDDEN'));
    expect(await testApp.db.select().from(userAcquisitions)).toHaveLength(0);
  });

  it('requires authentication', async () => {
    await request(testApp.app.getHttpServer())
      .post('/v1/me/acquisition')
      .send(body)
      .expect(401);
  });

  it('rejects fields outside the campaign allowlist', async () => {
    await client
      .post('/v1/me/acquisition')
      .send({ ...body, firstTouch: { utmSource: 'ok', email: 'private' } })
      .expect(400);
    expect(await testApp.db.select().from(userAcquisitions)).toHaveLength(0);
  });
});
