import { describe, expect, it } from 'vitest';

import { isSessionCookieName } from './session-cookie';

describe('isSessionCookieName', () => {
  it.each([
    'notefinder.session_token',
    '__Secure-notefinder.session_token',
    'notefinder-e2e-session',
  ])('recognizes the session cookie %s', (name) => {
    expect(isSessionCookieName(name)).toBe(true);
  });

  it.each(['NEXT_LOCALE', 'notefinderTheme', 'notefinder', 'theme'])(
    'ignores the unrelated cookie %s',
    (name) => {
      expect(isSessionCookieName(name)).toBe(false);
    },
  );
});
