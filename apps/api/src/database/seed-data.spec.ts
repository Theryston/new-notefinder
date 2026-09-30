import { setUsernameBodySchema, signUpBodySchema } from '@notefinder/contracts';
import {
  assertSeedAllowed,
  SEED_USER,
  SEED_USER_PASSWORD,
} from './seed-data.js';

describe('SEED_USER', () => {
  it('passes the sign-up rules, so developers can sign in with it', () => {
    const signUp = {
      name: SEED_USER.name,
      email: SEED_USER.email,
      password: SEED_USER_PASSWORD,
    };
    const username = { username: SEED_USER.username };

    expect(signUpBodySchema.parse(signUp)).toEqual(signUp);
    expect(setUsernameBodySchema.parse(username)).toEqual(username);
  });

  it('is stored like the API stores users (lowercase, verified)', () => {
    expect(SEED_USER.username).toBe(SEED_USER.username.toLowerCase());
    expect(SEED_USER.email).toBe(SEED_USER.email.toLowerCase());
    expect(SEED_USER.emailVerified).toBe(true);
  });
});

describe('assertSeedAllowed', () => {
  it('refuses to run in production', () => {
    expect(() => assertSeedAllowed('production')).toThrowError(/production/);
    expect(() => assertSeedAllowed('development')).not.toThrow();
    expect(() => assertSeedAllowed('test')).not.toThrow();
  });
});
