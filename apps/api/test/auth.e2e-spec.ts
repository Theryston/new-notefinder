import { currentUserSchema } from '@notefinder/contracts';
import { eq } from 'drizzle-orm';
import { accounts, sessions } from '../src/database/schema/auth.js';
import { users } from '../src/database/schema/users.js';
import {
  countEmailsTo,
  createAuthClient,
  sessionCookieFrom,
  signIn,
  signInWithUsername,
  signUp,
  signUpVerified,
  takeOtpEmail,
  verifyEmail,
} from './utils/auth.js';
import { useAuthSpec } from './utils/auth-spec.js';
import {
  createCredentialAccount,
  createPasswordUser,
  createUser,
  DEFAULT_PASSWORD,
  type User,
} from './utils/factories.js';

const NEW_USER = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  password: 'analytical-engine-1843',
};

const unauthorizedEnvelope = {
  statusCode: 401,
  code: 'UNAUTHORIZED',
  message: expect.any(String),
};

describe('Auth (e2e)', () => {
  const spec = useAuthSpec();

  const credentialHash = async (userId: string): Promise<string | null> => {
    const [account] = await spec.testApp.db
      .select({ password: accounts.password })
      .from(accounts)
      .where(eq(accounts.userId, userId));
    return account?.password ?? null;
  };

  const findUser = async (email: string): Promise<User | undefined> => {
    const [user] = await spec.testApp.db
      .select()
      .from(users)
      .where(eq(users.email, email));
    return user;
  };

  describe('email sign-up and verification', () => {
    it('signs in only after the emailed code verifies the email', async () => {
      const signUpResponse = await signUp(spec.client, NEW_USER).expect(200);
      expect(sessionCookieFrom(signUpResponse)).toBeUndefined();
      await spec.client.get('/v1/me').expect(401);
      expect(await spec.testApp.db.select().from(sessions)).toEqual([]);

      const signUpEmail = await takeOtpEmail(spec.testApp, NEW_USER.email);
      expect(signUpEmail.subject).toBe('Your notefinder verification code');

      const refused = await signIn(spec.client, NEW_USER).expect(403);
      expect(refused.body).toMatchObject({ code: 'EMAIL_NOT_VERIFIED' });
      expect(sessionCookieFrom(refused)).toBeUndefined();
      // Signing in unverified sends a fresh code, which replaces the first.
      const signInEmail = await takeOtpEmail(spec.testApp, NEW_USER.email);

      const verified = await verifyEmail(spec.client, {
        email: NEW_USER.email,
        otp: signInEmail.otp,
      }).expect(200);
      expect(sessionCookieFrom(verified)).toEqual(expect.any(String));

      const me = await spec.client.get('/v1/me').expect(200);
      expect(currentUserSchema.parse(me.body)).toEqual(me.body);
      expect(me.body).toMatchObject({
        name: NEW_USER.name,
        email: NEW_USER.email,
        emailVerified: true,
        username: null,
        image: null,
        role: 'USER',
      });
    });

    it('rejects a wrong code', async () => {
      await signUp(spec.client, NEW_USER).expect(200);
      const { otp } = await takeOtpEmail(spec.testApp, NEW_USER.email);
      const wrongOtp = otp === '000000' ? '111111' : '000000';

      const response = await verifyEmail(spec.client, {
        email: NEW_USER.email,
        otp: wrongOtp,
      }).expect(400);
      expect(sessionCookieFrom(response)).toBeUndefined();
      expect(await findUser(NEW_USER.email)).toMatchObject({
        emailVerified: false,
      });
    });

    it('never lets sign-up set the role', async () => {
      await signUp(spec.client, {
        ...NEW_USER,
        role: 'ADMIN',
      } as typeof NEW_USER).expect(200);
      expect(await findUser(NEW_USER.email)).toMatchObject({ role: 'USER' });
    });

    it('answers a sign-up with a taken email like a new one', async () => {
      await signUpVerified(spec.testApp, spec.client, NEW_USER);
      const newEmailResponse = await signUp(createAuthClient(spec.testApp), {
        ...NEW_USER,
        email: 'someone-else@example.com',
      }).expect(200);

      const takenEmailResponse = await signUp(createAuthClient(spec.testApp), {
        ...NEW_USER,
        name: 'Impostor',
        password: 'impostor-password-1',
      });

      expect(takenEmailResponse.status).toBe(200);
      expect(Object.keys(takenEmailResponse.body).sort()).toEqual(
        Object.keys(newEmailResponse.body).sort(),
      );
      expect(sessionCookieFrom(takenEmailResponse)).toBeUndefined();
      const matching = await spec.testApp.db
        .select()
        .from(users)
        .where(eq(users.email, NEW_USER.email));
      expect(matching).toHaveLength(1);
      expect(matching[0]?.name).toBe(NEW_USER.name);
      // The original password is untouched.
      await signIn(createAuthClient(spec.testApp), {
        email: NEW_USER.email,
        password: 'impostor-password-1',
      }).expect(401);
      await signIn(createAuthClient(spec.testApp), NEW_USER).expect(200);
    });
  });

  describe('email code locale', () => {
    it('sends the pt-BR template for Accept-Language: pt-BR', async () => {
      await signUp(
        spec.client.set('Accept-Language', 'pt-BR,pt;q=0.9'),
        NEW_USER,
      );

      const email = await takeOtpEmail(spec.testApp, NEW_USER.email);
      expect(email.subject).toBe('Seu código de verificação do notefinder');
      expect(email.html).toContain('<html lang="pt-BR">');
      expect(email.text).toContain(email.otp);
    });

    it('falls back to English for other languages', async () => {
      await signUp(spec.client.set('Accept-Language', 'fr-FR'), NEW_USER);

      const email = await takeOtpEmail(spec.testApp, NEW_USER.email);
      expect(email.subject).toBe('Your notefinder verification code');
      expect(email.html).toContain('<html lang="en">');
    });
  });

  describe('email sign-in and sign-out', () => {
    it('refuses a wrong password', async () => {
      const user = await createPasswordUser(spec.testApp.db);

      const response = await signIn(spec.client, {
        email: user.email,
        password: 'not-the-password',
      }).expect(401);
      expect(response.body).toMatchObject({
        code: 'INVALID_EMAIL_OR_PASSWORD',
      });
      expect(sessionCookieFrom(response)).toBeUndefined();
      await spec.client.get('/v1/me').expect(401);
    });

    it('refuses an unknown email the same way', async () => {
      const response = await signIn(spec.client, {
        email: 'nobody@example.com',
        password: DEFAULT_PASSWORD,
      }).expect(401);
      expect(response.body).toMatchObject({
        code: 'INVALID_EMAIL_OR_PASSWORD',
      });
    });

    it('signs out, revoking the session', async () => {
      const user = await createPasswordUser(spec.testApp.db);
      await signIn(spec.client, {
        email: user.email,
        password: DEFAULT_PASSWORD,
      }).expect(200);
      await spec.client.get('/v1/me').expect(200);

      await spec.client.post('/v1/auth/sign-out').expect(200);

      const response = await spec.client.get('/v1/me').expect(401);
      expect(response.body).toEqual(unauthorizedEnvelope);
      expect(await spec.testApp.db.select().from(sessions)).toEqual([]);
    });
  });

  describe('legacy bcrypt passwords', () => {
    const createLegacyUser = async (): Promise<User> => {
      const user = await createUser(spec.testApp.db);
      await createCredentialAccount(spec.testApp.db, user, {
        legacyBcrypt: true,
      });
      expect(await credentialHash(user.id)).toMatch(/^\$2a\$/);
      return user;
    };

    it('signs in and rehashes the password with scrypt', async () => {
      const user = await createLegacyUser();

      await signIn(spec.client, {
        email: user.email,
        password: DEFAULT_PASSWORD,
      }).expect(200);
      await spec.client.get('/v1/me').expect(200);

      const rehashed = await credentialHash(user.id);
      expect(rehashed).not.toMatch(/^\$2/);
      // Better Auth's scrypt format: `<salt hex>:<key hex>`.
      expect(rehashed).toMatch(/^[0-9a-f]+:[0-9a-f]+$/);

      await signIn(createAuthClient(spec.testApp), {
        email: user.email,
        password: DEFAULT_PASSWORD,
      }).expect(200);
      expect(await credentialHash(user.id)).toBe(rehashed);
    });

    it('rehashes on sign-in by username too', async () => {
      const user = await createLegacyUser();

      await signInWithUsername(spec.client, {
        username: user.username ?? '',
        password: DEFAULT_PASSWORD,
      }).expect(200);

      expect(await credentialHash(user.id)).not.toMatch(/^\$2/);
    });

    it('refuses a wrong password and keeps the legacy hash', async () => {
      const user = await createLegacyUser();
      const legacyHash = await credentialHash(user.id);

      await signIn(spec.client, {
        email: user.email,
        password: 'not-the-password',
      }).expect(401);

      expect(await credentialHash(user.id)).toBe(legacyHash);
    });
  });

  describe('password reset by code', () => {
    const NEW_PASSWORD = 'brand-new-password-2';

    const requestReset = (email: string, requester = spec.client) =>
      requester
        .post('/v1/auth/email-otp/request-password-reset')
        .send({ email });

    it('resets the password and revokes existing sessions', async () => {
      const user = await createPasswordUser(spec.testApp.db);
      const signedIn = createAuthClient(spec.testApp);
      await signIn(signedIn, {
        email: user.email,
        password: DEFAULT_PASSWORD,
      }).expect(200);
      await signedIn.get('/v1/me').expect(200);

      await requestReset(user.email).expect(200);
      const email = await takeOtpEmail(spec.testApp, user.email);
      expect(email.subject).toBe('Your notefinder password reset code');

      await spec.client
        .post('/v1/auth/email-otp/reset-password')
        .send({ email: user.email, otp: email.otp, password: NEW_PASSWORD })
        .expect(200);

      await signedIn.get('/v1/me').expect(401);
      await signIn(spec.client, {
        email: user.email,
        password: DEFAULT_PASSWORD,
      }).expect(401);
      await signIn(spec.client, {
        email: user.email,
        password: NEW_PASSWORD,
      }).expect(200);
      await spec.client.get('/v1/me').expect(200);
    });

    it('rejects a wrong code and keeps the password', async () => {
      const user = await createPasswordUser(spec.testApp.db);
      await requestReset(user.email).expect(200);
      const { otp } = await takeOtpEmail(spec.testApp, user.email);

      await spec.client
        .post('/v1/auth/email-otp/reset-password')
        .send({
          email: user.email,
          otp: otp === '000000' ? '111111' : '000000',
          password: NEW_PASSWORD,
        })
        .expect(400);

      await signIn(spec.client, {
        email: user.email,
        password: DEFAULT_PASSWORD,
      }).expect(200);
    });

    it('answers unknown emails the same way without sending anything', async () => {
      await requestReset('nobody@example.com').expect(200, { success: true });
      expect(await countEmailsTo(spec.testApp, 'nobody@example.com')).toBe(0);
    });

    it('sends the reset code in the requester language', async () => {
      const user = await createPasswordUser(spec.testApp.db);
      await requestReset(
        user.email,
        createAuthClient(spec.testApp).set('Accept-Language', 'pt-BR'),
      ).expect(200);

      const email = await takeOtpEmail(spec.testApp, user.email);
      expect(email.subject).toBe(
        'Seu código para redefinir a senha do notefinder',
      );
    });
  });

  describe('username', () => {
    const updateUser = (body: Record<string, unknown>) =>
      spec.client.post('/v1/auth/update-user').send(body);

    beforeEach(async () => {
      const user = await createPasswordUser(spec.testApp.db, {
        username: null,
      });
      await signIn(spec.client, {
        email: user.email,
        password: DEFAULT_PASSWORD,
      }).expect(200);
    });

    it('stores the username lowercased and signs in with it', async () => {
      await updateUser({ username: 'Ada_Lovelace' }).expect(200);

      const me = await spec.client.get('/v1/me').expect(200);
      expect(me.body).toMatchObject({ username: 'ada_lovelace' });

      await signInWithUsername(createAuthClient(spec.testApp), {
        username: 'ada_lovelace',
        password: DEFAULT_PASSWORD,
      }).expect(200);
      await signInWithUsername(createAuthClient(spec.testApp), {
        username: 'ADA_LOVELACE',
        password: DEFAULT_PASSWORD,
      }).expect(200);
    });

    it('refuses a wrong password on username sign-in', async () => {
      await updateUser({ username: 'ada' }).expect(200);

      await signInWithUsername(createAuthClient(spec.testApp), {
        username: 'ada',
        password: 'not-the-password',
      }).expect(401);
    });

    it('rejects a username that is already taken', async () => {
      await createPasswordUser(spec.testApp.db, { username: 'taken_name' });

      const response = await updateUser({ username: 'Taken_Name' }).expect(400);
      expect(response.body).toMatchObject({
        code: 'USERNAME_IS_ALREADY_TAKEN',
      });
      const me = await spec.client.get('/v1/me').expect(200);
      expect(me.body).toMatchObject({ username: null });
    });

    it.each([
      ['with space', 'INVALID_USERNAME'],
      ['dots.not.allowed', 'INVALID_USERNAME'],
      ['hyphen-ated', 'INVALID_USERNAME'],
      ['ação', 'INVALID_USERNAME'],
      ['ab', 'USERNAME_TOO_SHORT'],
      ['x'.repeat(51), 'USERNAME_TOO_LONG'],
    ])('rejects the invalid username %j', async (username, code) => {
      const response = await updateUser({ username }).expect(400);
      expect(response.body).toMatchObject({ code });
      const me = await spec.client.get('/v1/me').expect(200);
      expect(me.body).toMatchObject({ username: null });
    });

    it('never lets a user set their own role', async () => {
      const response = await updateUser({ role: 'ADMIN' }).expect(400);
      expect(response.body).toMatchObject({ code: 'FIELD_NOT_ALLOWED' });

      const me = await spec.client.get('/v1/me').expect(200);
      expect(me.body).toMatchObject({ role: 'USER' });
      await spec.client.get('/v1/e2e-auth-probe/admin').expect(403);
    });
  });

  describe('guards', () => {
    const signInAs = async (role: User['role']): Promise<User> => {
      const user = await createPasswordUser(spec.testApp.db, { role });
      await signIn(spec.client, {
        email: user.email,
        password: DEFAULT_PASSWORD,
      }).expect(200);
      return user;
    };

    it('serves @Public() routes to anonymous requests', async () => {
      await spec.client
        .get('/v1/e2e-auth-probe/public')
        .expect(200, { userId: null });
    });

    it('resolves the signed-in user on @Public() routes', async () => {
      const user = await signInAs('USER');
      await spec.client
        .get('/v1/e2e-auth-probe/public')
        .expect(200, { userId: user.id });
    });

    it('keeps routes private by default', async () => {
      const response = await spec.client
        .get('/v1/e2e-auth-probe/private')
        .expect(401);
      expect(response.body).toEqual(unauthorizedEnvelope);
    });

    it('returns 401 on @Roles() routes for anonymous requests', async () => {
      const response = await spec.client
        .get('/v1/e2e-auth-probe/admin')
        .expect(401);
      expect(response.body).toEqual(unauthorizedEnvelope);
    });

    it('returns the FORBIDDEN envelope to users without the role', async () => {
      await signInAs('USER');
      const response = await spec.client
        .get('/v1/e2e-auth-probe/admin')
        .expect(403);
      expect(response.body).toEqual({
        statusCode: 403,
        code: 'FORBIDDEN',
        message: expect.any(String),
      });
    });

    it('lets users with the role through', async () => {
      const admin = await signInAs('ADMIN');
      await spec.client
        .get('/v1/e2e-auth-probe/admin')
        .expect(200, { userId: admin.id });
    });
  });
});
