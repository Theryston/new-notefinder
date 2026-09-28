import { describe, expect, it } from 'vitest';

import type { SessionUser } from './session';
import {
  emailToVerify,
  isSignedInAndOnboarded,
  type SignInCredentials,
  signInCredentials,
} from './sign-in';

const byEmail: SignInCredentials = {
  method: 'email',
  email: 'ada@example.com',
  password: 'secret',
};

const byUsername: SignInCredentials = {
  method: 'username',
  username: 'ada',
  password: 'secret',
};

describe('signInCredentials', () => {
  it('signs in by email when the value has an @', () => {
    expect(
      signInCredentials({
        emailOrUsername: '  ada@example.com ',
        password: ' secret ',
      }),
    ).toEqual({
      method: 'email',
      email: 'ada@example.com',
      password: ' secret ',
    });
  });

  it('treats a malformed value with an @ as an email too', () => {
    expect(
      signInCredentials({ emailOrUsername: 'ada@', password: 'secret' }),
    ).toEqual({ method: 'email', email: 'ada@', password: 'secret' });
  });

  it('signs in by username otherwise', () => {
    expect(
      signInCredentials({ emailOrUsername: ' Ada_1 ', password: 'secret' }),
    ).toEqual({ method: 'username', username: 'Ada_1', password: 'secret' });
  });
});

describe('emailToVerify', () => {
  it('returns the typed email when it is not verified yet', () => {
    expect(emailToVerify('EMAIL_NOT_VERIFIED', byEmail)).toBe(
      'ada@example.com',
    );
  });

  it('is null for a username, whose email the form does not know', () => {
    expect(emailToVerify('EMAIL_NOT_VERIFIED', byUsername)).toBeNull();
  });

  it.each(['INVALID_EMAIL_OR_PASSWORD', 'RATE_LIMITED', 'UNKNOWN'] as const)(
    'is null for %s',
    (error) => {
      expect(emailToVerify(error, byEmail)).toBeNull();
    },
  );
});

describe('isSignedInAndOnboarded', () => {
  const user = (overrides: Partial<SessionUser> = {}): SessionUser => ({
    name: 'Ada',
    email: 'ada@example.com',
    emailVerified: true,
    username: 'ada',
    ...overrides,
  });

  it('is true for a verified user with a username', () => {
    expect(isSignedInAndOnboarded(user())).toBe(true);
  });

  it.each([
    ['signed out', null],
    ['session unknown', undefined],
    ['unverified email', user({ emailVerified: false })],
    ['no username', user({ username: null })],
  ])('is false when %s', (_, value) => {
    expect(isSignedInAndOnboarded(value)).toBe(false);
  });
});
