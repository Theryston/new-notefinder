import {
  countEmailsTo,
  createAuthClient,
  signIn,
  signUp,
  signUpVerified,
  takeEmail,
  takeOtpEmail,
} from './utils/auth.js';
import { useAuthSpec } from './utils/auth-spec.js';
import {
  createPasswordUser,
  DEFAULT_PASSWORD,
  type User,
} from './utils/factories.js';

const NEW_USER = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  password: 'analytical-engine-1843',
};

describe('Auth onboarding (e2e)', () => {
  const spec = useAuthSpec();

  describe('sign-up with an email that already has an account', () => {
    it('emails the owner instead of a verification code', async () => {
      const user = await createPasswordUser(spec.testApp.db);

      await signUp(spec.client, { ...NEW_USER, email: user.email }).expect(200);

      const email = await takeEmail(spec.testApp, user.email);
      expect(email.subject).toBe('You already have a notefinder account');
      expect(await countEmailsTo(spec.testApp, user.email)).toBe(0);
    });

    it('writes it in the requester language', async () => {
      const user = await createPasswordUser(spec.testApp.db);

      await signUp(
        createAuthClient(spec.testApp).set('Accept-Language', 'pt-BR'),
        {
          ...NEW_USER,
          email: user.email,
        },
      ).expect(200);

      const email = await takeEmail(spec.testApp, user.email);
      expect(email.subject).toBe('Você já tem uma conta no notefinder');
    });
  });

  describe('password length', () => {
    it('accepts a 6-character password on sign-up, like legacy', async () => {
      await signUpVerified(spec.testApp, spec.client, {
        ...NEW_USER,
        password: '123456',
      });
      await signIn(createAuthClient(spec.testApp), {
        email: NEW_USER.email,
        password: '123456',
      }).expect(200);
    });

    it('rejects a shorter one on sign-up', async () => {
      const response = await signUp(spec.client, {
        ...NEW_USER,
        password: '12345',
      }).expect(400);
      expect(response.body).toMatchObject({ code: 'PASSWORD_TOO_SHORT' });
      expect(await countEmailsTo(spec.testApp, NEW_USER.email)).toBe(0);
    });

    it('applies the same limit on password reset', async () => {
      const user = await createPasswordUser(spec.testApp.db);
      await spec.client
        .post('/v1/auth/email-otp/request-password-reset')
        .send({ email: user.email })
        .expect(200);
      const { otp } = await takeOtpEmail(spec.testApp, user.email);
      const reset = (password: string) =>
        spec.client
          .post('/v1/auth/email-otp/reset-password')
          .send({ email: user.email, otp, password });

      const tooShort = await reset('12345').expect(400);
      expect(tooShort.body).toMatchObject({ code: 'PASSWORD_TOO_SHORT' });
      await reset('654321').expect(200);
      await signIn(spec.client, {
        email: user.email,
        password: '654321',
      }).expect(200);
    });
  });

  describe('username required', () => {
    const usernameRequired = {
      statusCode: 403,
      code: 'USERNAME_REQUIRED',
      message: expect.any(String),
    };

    it('lets sign-up skip the username', async () => {
      await signUpVerified(spec.testApp, spec.client, NEW_USER);
      const me = await spec.client.get('/v1/me').expect(200);
      expect(me.body).toMatchObject({ username: null });
    });

    it('stores the username given on sign-up', async () => {
      await signUpVerified(spec.testApp, spec.client, {
        ...NEW_USER,
        username: 'Ada_Lovelace',
      });
      const me = await spec.client.get('/v1/me').expect(200);
      expect(me.body).toMatchObject({ username: 'ada_lovelace' });
      await spec.client.get('/v1/e2e-auth-probe/private').expect(200);
    });

    describe('signed in without a username', () => {
      let user: User;

      beforeEach(async () => {
        user = await createPasswordUser(spec.testApp.db, { username: null });
        await signIn(spec.client, {
          email: user.email,
          password: DEFAULT_PASSWORD,
        }).expect(200);
      });

      it('blocks private routes with USERNAME_REQUIRED', async () => {
        const response = await spec.client
          .get('/v1/e2e-auth-probe/private')
          .expect(403);
        expect(response.body).toEqual(usernameRequired);
      });

      it('checks the username before the role', async () => {
        const response = await spec.client
          .get('/v1/e2e-auth-probe/admin')
          .expect(403);
        expect(response.body).toEqual(usernameRequired);
      });

      it('still serves GET /v1/me and public routes', async () => {
        await spec.client.get('/v1/me').expect(200);
        await spec.client
          .get('/v1/e2e-auth-probe/public')
          .expect(200, { userId: user.id });
      });

      it('unblocks private routes once the username is set', async () => {
        await spec.client
          .post('/v1/auth/update-user')
          .send({ username: 'ada' })
          .expect(200);
        await spec.client
          .get('/v1/e2e-auth-probe/private')
          .expect(200, { userId: user.id });
      });
    });
  });
});
