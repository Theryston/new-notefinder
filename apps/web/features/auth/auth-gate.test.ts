import { describe, expect, it } from 'vitest';

import { requiredAuthStep } from './auth-gate';
import type { SessionUser } from './session';

const user = (overrides: Partial<SessionUser> = {}): SessionUser => ({
  name: 'Ada',
  email: 'ada@example.com',
  emailVerified: true,
  username: 'ada',
  ...overrides,
});

describe('requiredAuthStep', () => {
  it('leaves signed-out visitors alone', () => {
    expect(requiredAuthStep(null, '/tracks/abc', '')).toBeNull();
    expect(requiredAuthStep(undefined, '/', '')).toBeNull();
  });

  it('leaves users who finished onboarding alone', () => {
    expect(requiredAuthStep(user(), '/tracks/abc', '?x=1')).toBeNull();
  });

  it('sends an unverified user to verify the email, back to the page after', () => {
    expect(
      requiredAuthStep(user({ emailVerified: false }), '/tracks/abc', '?x=1'),
    ).toEqual({
      pathname: '/verify-email',
      query: { email: 'ada@example.com', redirectTo: '/tracks/abc?x=1' },
    });
  });

  it('verifies the email before asking for a username', () => {
    expect(
      requiredAuthStep(
        user({ emailVerified: false, username: null }),
        '/setup-username',
        '?redirectTo=%2Fme%2Fedit',
      ),
    ).toEqual({
      pathname: '/verify-email',
      query: { email: 'ada@example.com', redirectTo: '/me/edit' },
    });
  });

  it('sends a user without a username to pick one', () => {
    expect(requiredAuthStep(user({ username: null }), '/', '')).toEqual({
      pathname: '/setup-username',
      query: {},
    });
  });

  it('keeps the destination of an auth page instead of the page itself', () => {
    expect(
      requiredAuthStep(
        user({ username: null }),
        '/verify-email',
        '?email=ada%40example.com&redirectTo=%2Ftracks%2Fabc',
      ),
    ).toEqual({
      pathname: '/setup-username',
      query: { redirectTo: '/tracks/abc' },
    });
  });

  it('does nothing on the step the user is on', () => {
    expect(
      requiredAuthStep(user({ emailVerified: false }), '/verify-email', ''),
    ).toBeNull();
    expect(
      requiredAuthStep(user({ username: null }), '/setup-username', ''),
    ).toBeNull();
  });
});
