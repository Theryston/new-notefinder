import { eq } from 'drizzle-orm';
import { users } from '../src/database/schema/users.js';
import { createAuthClient, takeOtpEmail, verifyEmail } from './utils/auth.js';
import { createTestApp, type TestApp } from './utils/create-test-app.js';
import { resetDatabase } from './utils/database.js';

const PASSWORD = 'correct-horse-battery';

// A new account starts in the language its sign-up request asks for (the same
// supported set as the emails), so its emails follow the site it signed up on.
describe('sign-up sets the locale of the account (e2e)', () => {
  let testApp: TestApp;

  /** Signs up with the given `Accept-Language` (none when omitted), then verifies. */
  const signUpAndVerify = async (
    email: string,
    acceptLanguage?: string,
  ): Promise<void> => {
    const client = createAuthClient(testApp);
    const signUp = client.post('/v1/auth/sign-up/email');
    if (acceptLanguage !== undefined) {
      signUp.set('Accept-Language', acceptLanguage);
    }
    await signUp
      .send({ name: 'Ada Lovelace', email, password: PASSWORD })
      .expect(200);
    const { otp } = await takeOtpEmail(testApp, email);
    await verifyEmail(client, { email, otp }).expect(200);
  };

  const localeOf = async (email: string): Promise<string | undefined> => {
    const [row] = await testApp.db
      .select({ locale: users.locale })
      .from(users)
      .where(eq(users.email, email));
    return row?.locale;
  };

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.close();
  });

  beforeEach(async () => {
    await resetDatabase(testApp.db);
  });

  it('stores the Portuguese locale of a Brazilian sign-up request', async () => {
    await signUpAndVerify('ada@example.com', 'pt-BR,pt;q=0.9,en;q=0.8');

    expect(await localeOf('ada@example.com')).toBe('pt-BR');
  });

  it('stores English for a request in a language the app does not speak', async () => {
    await signUpAndVerify('grace@example.com', 'fr-FR,fr;q=0.9');

    expect(await localeOf('grace@example.com')).toBe('en');
  });

  it('stores English for a request that says nothing about its language', async () => {
    await signUpAndVerify('alan@example.com');

    expect(await localeOf('alan@example.com')).toBe('en');
  });
});
