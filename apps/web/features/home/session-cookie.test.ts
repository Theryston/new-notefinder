import { describe, expect, it } from 'vitest';

import { isSessionCookieName } from './session-cookie';

describe('isSessionCookieName', () => {
  it.each([
    'notefinder.session_token',
    '__Secure-notefinder.session_token',
    'notefinder.session_data',
  ])('recognizes the Better Auth session cookie %s', (name) => {
    expect(isSessionCookieName(name)).toBe(true);
  });

  it.each([
    'NEXT_LOCALE',
    'notefinderTheme',
    'notefinder',
    'notefinder-e2e-session',
    'theme',
  ])('ignores the unrelated cookie %s', (name) => {
    expect(isSessionCookieName(name)).toBe(false);
  });
});
