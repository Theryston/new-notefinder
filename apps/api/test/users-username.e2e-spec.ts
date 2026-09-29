import { currentUserSchema } from '@notefinder/contracts';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { users } from '../src/database/schema/users.js';
import { createAuthClient, signIn, signInWithUsername } from './utils/auth.js';
import { useAuthSpec } from './utils/auth-spec.js';
import {
  createPasswordUser,
  DEFAULT_PASSWORD,
  type User,
} from './utils/factories.js';

const errorEnvelope = (statusCode: number, code: string) => ({
  statusCode,
  code,
  message: expect.any(String),
});

describe('PUT /v1/me/username (e2e)', () => {
  const spec = useAuthSpec();
  let user: User;

  const signInAs = async (target: User) => {
    await signIn(spec.client, {
      email: target.email,
      password: DEFAULT_PASSWORD,
    }).expect(200);
  };

  const setUsername = (body: Record<string, unknown>) =>
    spec.client.put('/v1/me/username').send(body);

  const storedUsername = async (id: string): Promise<string | null> => {
    const [row] = await spec.testApp.db
      .select({ username: users.username })
      .from(users)
      .where(eq(users.id, id));
    return row?.username ?? null;
  };

  describe('signed in without a username', () => {
    beforeEach(async () => {
      user = await createPasswordUser(spec.testApp.db, { username: null });
      await signInAs(user);
    });

    it('stores the username lowercased and returns the current user', async () => {
      const response = await setUsername({ username: 'Ada_Lovelace' }).expect(
        200,
      );

      expect(currentUserSchema.parse(response.body)).toEqual(response.body);
      expect(response.body).toMatchObject({
        id: user.id,
        email: user.email,
        username: 'ada_lovelace',
      });
      expect(await storedUsername(user.id)).toBe('ada_lovelace');
      const me = await spec.client.get('/v1/me').expect(200);
      expect(me.body).toMatchObject({ username: 'ada_lovelace' });
    });

    it('trims the username before storing it', async () => {
      await setUsername({ username: '  ada  ' }).expect(200);
      expect(await storedUsername(user.id)).toBe('ada');
    });

    it('lets the user sign in with the username, in any case', async () => {
      await setUsername({ username: 'Ada_Lovelace' }).expect(200);

      await signInWithUsername(createAuthClient(spec.testApp), {
        username: 'ada_lovelace',
        password: DEFAULT_PASSWORD,
      }).expect(200);
      await signInWithUsername(createAuthClient(spec.testApp), {
        username: 'ADA_LOVELACE',
        password: DEFAULT_PASSWORD,
      }).expect(200);
      await signInWithUsername(createAuthClient(spec.testApp), {
        username: 'ada_lovelace',
        password: 'not-the-password',
      }).expect(401);
    });

    it('unblocks the private routes', async () => {
      await spec.client.get('/v1/e2e-auth-probe/private').expect(403);

      await setUsername({ username: 'ada' }).expect(200);

      await spec.client
        .get('/v1/e2e-auth-probe/private')
        .expect(200, { userId: user.id });
    });

    it.each(['taken_name', 'Taken_Name'])(
      'answers CONFLICT for the taken username %j and changes nothing',
      async (sent) => {
        await createPasswordUser(spec.testApp.db, { username: 'taken_name' });

        const response = await setUsername({ username: sent }).expect(409);

        expect(response.body).toEqual(errorEnvelope(409, 'CONFLICT'));
        expect(await storedUsername(user.id)).toBeNull();
      },
    );

    it.each([
      ['with space'],
      ['dots.not.allowed'],
      ['hyphen-ated'],
      ['ação'],
      ['ab'],
      ['x'.repeat(51)],
      [''],
    ])('rejects the invalid username %j', async (username) => {
      const response = await setUsername({ username }).expect(400);

      expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' });
      expect(await storedUsername(user.id)).toBeNull();
    });

    it('rejects a body without a username', async () => {
      const response = await setUsername({}).expect(400);
      expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' });
    });
  });

  describe('signed in with a username already', () => {
    beforeEach(async () => {
      user = await createPasswordUser(spec.testApp.db, { username: 'first' });
      await signInAs(user);
    });

    it('answers CONFLICT and keeps the username', async () => {
      const response = await setUsername({ username: 'second' }).expect(409);

      expect(response.body).toEqual(errorEnvelope(409, 'CONFLICT'));
      expect(await storedUsername(user.id)).toBe('first');
    });

    it('answers CONFLICT even for the same username in another case', async () => {
      await setUsername({ username: 'FIRST' }).expect(409);
      expect(await storedUsername(user.id)).toBe('first');
    });
  });

  it('answers UNAUTHORIZED when signed out', async () => {
    const response = await request(spec.testApp.app.getHttpServer())
      .put('/v1/me/username')
      .send({ username: 'ada' })
      .expect(401);

    expect(response.body).toEqual(errorEnvelope(401, 'UNAUTHORIZED'));
  });
});
