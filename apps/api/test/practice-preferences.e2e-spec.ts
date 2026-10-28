import {
  type PracticePreferences,
  practicePreferencesSchema,
} from '@vozzify/contracts';
import request from 'supertest';
import { signIn } from './utils/auth.js';
import { useAuthSpec } from './utils/auth-spec.js';
import {
  createCredentialAccount,
  createUser,
  DEFAULT_PASSWORD,
  type User,
} from './utils/factories.js';

// GET and PATCH /v1/me/practice-preferences keep what follows the signed-in
// User across devices. Nothing is stored until the first change: until then
// the User reads the same defaults the page uses for visitors.
describe('Practice preferences (e2e)', () => {
  const spec = useAuthSpec();
  let user: User;

  const read = async (): Promise<PracticePreferences> => {
    const response = await spec.client
      .get('/v1/me/practice-preferences')
      .expect(200);
    return practicePreferencesSchema.parse(response.body);
  };

  beforeEach(async () => {
    user = await createUser(spec.testApp.db, { username: 'grace' });
    await createCredentialAccount(spec.testApp.db, user);
    await signIn(spec.client, {
      email: user.email,
      password: DEFAULT_PASSWORD,
    }).expect(200);
  });

  it('answers 401 without a session', async () => {
    const server = request(spec.testApp.app.getHttpServer());

    for (const response of [
      await server.get('/v1/me/practice-preferences').expect(401),
      await server
        .patch('/v1/me/practice-preferences')
        .send({ difficulty: 'HARD' })
        .expect(401),
    ]) {
      expect(response.body).toMatchObject({ code: 'UNAUTHORIZED' });
    }
  });

  it('reads the page defaults until the first change', async () => {
    await expect(read()).resolves.toEqual({
      difficulty: 'NORMAL',
      octaveMode: 'ANY',
      guideMelody: false,
      countIn: true,
    });
  });

  it('writes the changed preferences and reads them back', async () => {
    const response = await spec.client
      .patch('/v1/me/practice-preferences')
      .send({ difficulty: 'HARD', guideMelody: true, countIn: false })
      .expect(200);

    expect(practicePreferencesSchema.parse(response.body)).toEqual({
      difficulty: 'HARD',
      octaveMode: 'ANY',
      guideMelody: true,
      countIn: false,
    });
    await expect(read()).resolves.toMatchObject({ difficulty: 'HARD' });
  });

  it('keeps each User preferences apart', async () => {
    await spec.client
      .patch('/v1/me/practice-preferences')
      .send({ difficulty: 'EASY' })
      .expect(200);
    const other = await createUser(spec.testApp.db, { username: 'ada' });
    await createCredentialAccount(spec.testApp.db, other);
    await signIn(spec.client, {
      email: other.email,
      password: DEFAULT_PASSWORD,
    }).expect(200);

    await expect(read()).resolves.toMatchObject({ difficulty: 'NORMAL' });
  });

  it('refuses an unknown difficulty with VALIDATION_FAILED', async () => {
    const response = await spec.client
      .patch('/v1/me/practice-preferences')
      .send({ difficulty: 'EXTREME' })
      .expect(400);

    expect(response.body).toMatchObject({
      code: 'VALIDATION_FAILED',
      details: { location: 'body' },
    });
  });
});
