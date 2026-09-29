import { NAME_MAX_LENGTH } from '@notefinder/contracts';
import { users } from '../src/database/schema/users.js';
import {
  countEmailsTo,
  signUp,
  signUpVerified,
  takeOtpEmail,
  verifyEmail,
} from './utils/auth.js';
import { useAuthSpec } from './utils/auth-spec.js';
import { createPasswordUser, type User } from './utils/factories.js';

const NEW_USER = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  password: 'analytical-engine-1843',
};

const EXTERNAL_IMAGE = 'https://evil.example/avatar.png';

describe('Sign-up rules (e2e)', () => {
  const spec = useAuthSpec();

  // Raw body: the typed `signUp` helper only knows the fields a client may
  // send, and these tests send the ones it must not.
  const postSignUp = (body: Record<string, unknown>) =>
    spec.client.post('/v1/auth/sign-up/email').send(body);

  const allUsers = (): Promise<User[]> => spec.testApp.db.select().from(users);

  const findUser = async (email: string): Promise<User | undefined> =>
    (await allUsers()).find((user) => user.email === email);

  describe('the Avatar', () => {
    it.each([
      ['an external URL', EXTERNAL_IMAGE],
      ['a data URL', 'data:image/png;base64,iVBORw0KGgo='],
      ['an empty string', ''],
      ['null', null],
    ])('refuses %s and creates nothing', async (_label, image) => {
      const response = await postSignUp({ ...NEW_USER, image }).expect(400);

      expect(response.body).toMatchObject({ code: 'IMAGE_NOT_ALLOWED' });
      expect(await allUsers()).toEqual([]);
      expect(await countEmailsTo(spec.testApp, NEW_USER.email)).toBe(0);
    });

    it('never stores the image, even once the email is verified', async () => {
      await postSignUp({ ...NEW_USER, image: EXTERNAL_IMAGE }).expect(400);

      await signUpVerified(spec.testApp, spec.client, NEW_USER);

      expect(await findUser(NEW_USER.email)).toMatchObject({ image: null });
      const me = await spec.client.get('/v1/me').expect(200);
      expect(me.body).toMatchObject({ image: null });
    });

    it('refuses an image for a taken email like for a new one', async () => {
      const user = await createPasswordUser(spec.testApp.db);

      const response = await postSignUp({
        ...NEW_USER,
        email: user.email,
        image: EXTERNAL_IMAGE,
      }).expect(400);

      expect(response.body).toMatchObject({ code: 'IMAGE_NOT_ALLOWED' });
      expect(await countEmailsTo(spec.testApp, user.email)).toBe(0);
    });
  });

  describe('the Name', () => {
    const noName = { email: NEW_USER.email, password: NEW_USER.password };

    it.each([
      ['empty', { ...NEW_USER, name: '' }],
      ['blank', { ...NEW_USER, name: '   ' }],
      [
        'longer than the limit',
        { ...NEW_USER, name: 'a'.repeat(NAME_MAX_LENGTH + 1) },
      ],
      [
        'longer than the limit once trimmed',
        { ...NEW_USER, name: ` ${'a'.repeat(NAME_MAX_LENGTH + 1)} ` },
      ],
      ['missing', noName],
      ['null', { ...NEW_USER, name: null }],
      ['not a string', { ...NEW_USER, name: 42 }],
    ])('rejects a Name that is %s and creates nothing', async (_l, body) => {
      const response = await postSignUp(body).expect(400);

      expect(response.body).toMatchObject({ code: 'INVALID_NAME' });
      expect(await allUsers()).toEqual([]);
      expect(await countEmailsTo(spec.testApp, NEW_USER.email)).toBe(0);
    });

    it('rejects an invalid Name for a taken email like for a new one', async () => {
      const user = await createPasswordUser(spec.testApp.db);

      const response = await postSignUp({
        ...NEW_USER,
        email: user.email,
        name: '',
      }).expect(400);

      expect(response.body).toMatchObject({ code: 'INVALID_NAME' });
      expect(await countEmailsTo(spec.testApp, user.email)).toBe(0);
    });

    it('accepts a Name of exactly the limit', async () => {
      const name = 'a'.repeat(NAME_MAX_LENGTH);

      await signUp(spec.client, { ...NEW_USER, name }).expect(200);

      expect(await findUser(NEW_USER.email)).toMatchObject({ name });
    });

    it('stores the Name trimmed', async () => {
      await signUp(spec.client, {
        ...NEW_USER,
        name: '  Ada Lovelace  ',
      }).expect(200);

      expect(await findUser(NEW_USER.email)).toMatchObject({
        name: 'Ada Lovelace',
      });
    });
  });

  describe('a normal sign-up', () => {
    it('creates the User with the given Name, verified by the emailed code', async () => {
      await signUp(spec.client, NEW_USER).expect(200);
      expect(await findUser(NEW_USER.email)).toMatchObject({
        name: NEW_USER.name,
        image: null,
        emailVerified: false,
        username: null,
      });

      const { otp } = await takeOtpEmail(spec.testApp, NEW_USER.email);
      await verifyEmail(spec.client, { email: NEW_USER.email, otp }).expect(
        200,
      );

      expect(await findUser(NEW_USER.email)).toMatchObject({
        emailVerified: true,
      });
    });
  });
});
