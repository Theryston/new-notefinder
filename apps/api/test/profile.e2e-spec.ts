import {
  cacheTags,
  currentUserSchema,
  NAME_MAX_LENGTH,
} from '@notefinder/contracts';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { users } from '../src/database/schema/users.js';
import {
  WEB_REVALIDATION_JOB,
  WEB_REVALIDATION_QUEUE,
} from '../src/integrations/web-revalidation/web-revalidation.job.js';
import { createAuthClient, signIn } from './utils/auth.js';
import { useAuthSpec } from './utils/auth-spec.js';
import {
  createCredentialAccount,
  createUser,
  DEFAULT_PASSWORD,
  type User,
} from './utils/factories.js';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=',
  'base64',
);

describe('PATCH /v1/me (e2e)', () => {
  const spec = useAuthSpec();
  let user: User;

  const revalidations = () =>
    spec.testApp.queues[WEB_REVALIDATION_QUEUE]?.added ?? [];

  const nameInDatabase = async () => {
    const [row] = await spec.testApp.db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, user.id));
    return row?.name;
  };

  const signInAs = async (overrides: Partial<User> = {}) => {
    user = await createUser(spec.testApp.db, {
      name: 'Grace Hopper',
      email: 'grace@example.com',
      username: 'grace',
      image: 'https://example.com/grace.png',
      ...overrides,
    });
    await createCredentialAccount(spec.testApp.db, user);
    await signIn(spec.client, {
      email: user.email,
      password: DEFAULT_PASSWORD,
    }).expect(200);
  };

  beforeEach(async () => {
    revalidations().length = 0;
    await signInAs();
  });

  describe('who can call it', () => {
    it('returns the UNAUTHORIZED envelope without a session', async () => {
      const response = await request(spec.testApp.app.getHttpServer())
        .patch('/v1/me')
        .field('name', 'Rear Admiral')
        .expect(401);

      expect(response.body).toEqual({
        statusCode: 401,
        code: 'UNAUTHORIZED',
        message: expect.any(String),
      });
      expect(await nameInDatabase()).toBe('Grace Hopper');
    });

    it('returns USERNAME_REQUIRED until a username is chosen', async () => {
      const newcomer = await createUser(spec.testApp.db, {
        name: 'Newcomer',
        email: 'newcomer@example.com',
        username: null,
      });
      await createCredentialAccount(spec.testApp.db, newcomer);
      const client = createAuthClient(spec.testApp);
      await signIn(client, {
        email: newcomer.email,
        password: DEFAULT_PASSWORD,
      }).expect(200);

      const response = await client
        .patch('/v1/me')
        .field('name', 'Someone Else')
        .expect(403);

      expect(response.body).toMatchObject({ code: 'USERNAME_REQUIRED' });
      expect(revalidations()).toEqual([]);
    });
  });

  describe('changing the Name', () => {
    it('saves it trimmed and returns the current user', async () => {
      const before = await spec.client.get('/v1/me').expect(200);

      const response = await spec.client
        .patch('/v1/me')
        .field('name', '  Rear Admiral Grace Hopper  ')
        .expect(200);

      // Same user as `GET /v1/me`, with only the Name changed.
      expect(response.body).toEqual({
        ...before.body,
        name: 'Rear Admiral Grace Hopper',
      });
      expect(currentUserSchema.parse(response.body)).toEqual(response.body);
      expect(await nameInDatabase()).toBe('Rear Admiral Grace Hopper');
      const me = await spec.client.get('/v1/me').expect(200);
      expect(me.body).toEqual(response.body);
    });

    it('accepts a Name of exactly the maximum length', async () => {
      const name = 'g'.repeat(NAME_MAX_LENGTH);

      const response = await spec.client
        .patch('/v1/me')
        .field('name', name)
        .expect(200);

      expect(response.body.name).toBe(name);
    });

    it('changes nothing but the Name, whatever else is sent', async () => {
      await spec.client
        .patch('/v1/me')
        .field('name', 'Rear Admiral')
        .field('username', 'admiral')
        .field('image', 'https://evil.example/tracker.png')
        .field('email', 'admiral@example.com')
        .field('role', 'ADMIN')
        .expect(200);

      const [row] = await spec.testApp.db
        .select()
        .from(users)
        .where(eq(users.id, user.id));
      expect(row).toMatchObject({
        name: 'Rear Admiral',
        username: 'grace',
        image: 'https://example.com/grace.png',
        email: 'grace@example.com',
        role: 'USER',
      });
    });

    it('enqueues the revalidation of the Profile page', async () => {
      await spec.client
        .patch('/v1/me')
        .field('name', 'Rear Admiral')
        .expect(200);

      expect(revalidations()).toEqual([
        {
          name: WEB_REVALIDATION_JOB,
          data: { tags: [cacheTags.userProfile('grace')] },
        },
      ]);
    });

    it('keeps a longer imported Name as it is until it is edited', async () => {
      const imported = 'g'.repeat(NAME_MAX_LENGTH + 50);
      await spec.testApp.db
        .update(users)
        .set({ name: imported })
        .where(eq(users.id, user.id));

      const me = await spec.client.get('/v1/me').expect(200);

      expect(me.body.name).toBe(imported);
    });
  });

  describe('invalid requests', () => {
    it.each([
      ['an empty Name', ''],
      ['a blank Name', '   '],
      ['a Name over the limit', 'g'.repeat(NAME_MAX_LENGTH + 1)],
    ])('rejects %s with VALIDATION_FAILED', async (_label, name) => {
      const response = await spec.client
        .patch('/v1/me')
        .field('name', name)
        .expect(400);

      expect(response.body).toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_FAILED',
        details: { location: 'body' },
      });
      expect(await nameInDatabase()).toBe('Grace Hopper');
      expect(revalidations()).toEqual([]);
    });

    it('rejects a request without a Name with VALIDATION_FAILED', async () => {
      const response = await spec.client
        .patch('/v1/me')
        .field('role', 'ADMIN')
        .expect(400);

      expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' });
    });

    it('rejects a form field far bigger than any Name', async () => {
      const response = await spec.client
        .patch('/v1/me')
        .field('name', 'g'.repeat(20 * 1024))
        .expect(400);

      expect(response.body).toMatchObject({ code: 'BAD_REQUEST' });
      expect(await nameInDatabase()).toBe('Grace Hopper');
    });

    it('rejects a file part until avatars are supported', async () => {
      const response = await spec.client
        .patch('/v1/me')
        .field('name', 'Rear Admiral')
        .attach('avatar', PNG, 'avatar.png')
        .expect(400);

      expect(response.body).toMatchObject({ code: 'BAD_REQUEST' });
      expect(await nameInDatabase()).toBe('Grace Hopper');
      expect(revalidations()).toEqual([]);
    });
  });
});
