import type { Page } from '@playwright/test';

import type { MockUser } from './auth-api-mock';

/**
 * The sign-in endpoints of the auth mock: signing in makes `user` the
 * session's user, as the API does, so the page the round trip returns to sees
 * it.
 */
export function signInOverrides(user: MockUser) {
  let signedIn = false;
  return {
    '/sign-in/email': () => {
      signedIn = true;
      return { body: { redirect: false, token: 'token', user } };
    },
    '/get-session': () => ({
      body: signedIn ? { session: { id: 'ses_1' }, user } : null,
    }),
  };
}

/** Counts the `POST /v1/tracks` requests the page sends. */
export function countTrackRequests(page: Page): () => number {
  let count = 0;
  page.on('request', (request) => {
    if (
      request.method() === 'POST' &&
      new URL(request.url()).pathname === '/v1/tracks'
    ) {
      count += 1;
    }
  });
  return () => count;
}
