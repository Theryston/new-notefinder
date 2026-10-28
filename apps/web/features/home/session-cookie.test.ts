import { describe, expect, it } from 'vitest';

import { hasSessionCookie, isSessionCookieName } from './session-cookie';

describe('isSessionCookieName', () => {
  it.each([
    'vozzify.session_token',
    '__Secure-vozzify.session_token',
    'vozzify.session_data',
  ])('recognizes the Better Auth session cookie %s', (name) => {
    expect(isSessionCookieName(name)).toBe(true);
  });

  it.each([
    'NEXT_LOCALE',
    'vozzifyTheme',
    'vozzify',
    'vozzify-e2e-session',
    'theme',
  ])('ignores the unrelated cookie %s', (name) => {
    expect(isSessionCookieName(name)).toBe(false);
  });
});

describe('hasSessionCookie', () => {
  it('is true when any cookie is a session cookie', () => {
    expect(
      hasSessionCookie(['NEXT_LOCALE', '__Secure-vozzify.session_token']),
    ).toBe(true);
  });

  it('is false without cookies or without a session cookie', () => {
    expect(hasSessionCookie([])).toBe(false);
    expect(hasSessionCookie(['NEXT_LOCALE', 'theme'])).toBe(false);
  });
});
