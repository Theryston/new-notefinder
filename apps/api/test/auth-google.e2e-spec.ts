import { eq } from 'drizzle-orm';
import { accounts } from '../src/database/schema/auth.js';
import { users } from '../src/database/schema/users.js';
import type { AuthClient } from './utils/auth.js';
import { useAuthSpec } from './utils/auth-spec.js';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CALLBACK_URL = 'http://localhost:3000/en';

const GOOGLE_PROFILE = {
  sub: 'google-sub-1',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  email_verified: true,
  picture: 'https://lh3.googleusercontent.com/a/ada-lovelace',
};

const base64Url = (value: unknown): string =>
  Buffer.from(JSON.stringify(value)).toString('base64url');

/**
 * Answers Google's token endpoint with an id token carrying `profile`. Better
 * Auth reads the user from that token (it trusts the code exchange), so no
 * network call to Google is needed; any other request goes through.
 */
const stubGoogleTokenEndpoint = (profile: typeof GOOGLE_PROFILE): void => {
  const realFetch = globalThis.fetch;
  const idToken = [
    base64Url({ alg: 'RS256', typ: 'JWT' }),
    base64Url(profile),
    'signature',
  ].join('.');
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url !== GOOGLE_TOKEN_URL) return realFetch(input, init);
    return Promise.resolve(
      Response.json({
        access_token: 'google-access-token',
        id_token: idToken,
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'openid email profile',
      }),
    );
  });
};

/** Runs the OAuth dance up to the callback, as the browser does. */
const signInWithGoogle = async (client: AuthClient) => {
  const start = await client
    .post('/v1/auth/sign-in/social')
    .send({ provider: 'google', callbackURL: CALLBACK_URL })
    .expect(200);
  const state = new URL(start.body.url).searchParams.get('state');
  return client
    .get('/v1/auth/callback/google')
    .query({ code: 'google-code', state });
};

describe('Google sign-up (e2e)', () => {
  const spec = useAuthSpec({
    env: { GOOGLE_CLIENT_ID: 'google-id', GOOGLE_CLIENT_SECRET: 'secret' },
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates the User with the Google picture as the Avatar', async () => {
    stubGoogleTokenEndpoint(GOOGLE_PROFILE);

    const callback = await signInWithGoogle(spec.client);

    expect(callback.status).toBe(302);
    expect(callback.headers.location).toBe(CALLBACK_URL);
    const [user] = await spec.testApp.db
      .select()
      .from(users)
      .where(eq(users.email, GOOGLE_PROFILE.email));
    expect(user).toMatchObject({
      name: GOOGLE_PROFILE.name,
      image: GOOGLE_PROFILE.picture,
      emailVerified: true,
      username: null,
    });
    const linked = await spec.testApp.db
      .select({ providerId: accounts.providerId })
      .from(accounts)
      .where(eq(accounts.userId, user?.id ?? ''));
    expect(linked).toEqual([{ providerId: 'google' }]);
    const me = await spec.client.get('/v1/me').expect(200);
    expect(me.body).toMatchObject({
      name: GOOGLE_PROFILE.name,
      image: GOOGLE_PROFILE.picture,
      username: null,
    });
  });
});
