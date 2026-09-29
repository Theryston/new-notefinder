import type { Page, Request, Route } from '@playwright/test';

// Any host: the API URL the browser calls is inlined when the app is built
// (`NEXT_PUBLIC_API_URL`), so it depends on the build, not on this suite.
const AUTH_ROUTES = '**/v1/auth/**';
// notefinder's own route the setup-username step calls.
const USERNAME_ROUTE = '**/v1/me/username';

export const WRONG_OTP = '000000';
export const RIGHT_OTP = '424242';
export const TAKEN_USERNAME = 'taken_name';

export type MockUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  username: string | null;
  image: string | null;
  createdAt: string;
  updatedAt: string;
};

export const ADA: MockUser = {
  id: 'usr_ada',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  emailVerified: true,
  username: null,
  image: null,
  createdAt: '2026-09-28T12:00:00.000Z',
  updatedAt: '2026-09-28T12:00:00.000Z',
};

type Reply = { status?: number; body: unknown };
type Handler = (request: Request) => Reply;

// The browser calls the API cross-origin with cookies, so every reply
// (preflights included) needs the CORS headers the real API sends.
async function fulfill(route: Route, reply: Reply) {
  const origin = route.request().headers().origin ?? '*';
  await route.fulfill({
    status: reply.status ?? 200,
    headers: {
      'access-control-allow-origin': origin,
      'access-control-allow-credentials': 'true',
      'access-control-allow-headers': 'content-type',
      'access-control-allow-methods': 'GET, POST, PUT, OPTIONS',
      'content-type': 'application/json',
    },
    body: JSON.stringify(reply.body),
  });
}

const bodyOf = (request: Request): Record<string, unknown> =>
  request.postDataJSON() ?? {};

// The `CurrentUser` the API answers with.
const currentUserOf = (user: MockUser) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  emailVerified: user.emailVerified,
  username: user.username,
  image: user.image,
  role: 'USER',
  createdAt: user.createdAt,
});

/**
 * Better Auth's endpoints (keyed by their path under `/v1/auth`) and the
 * username route (`/me/username`) over a tiny session state, so the gate sees
 * what the real API would: signed out until the email is verified, then
 * signed in until `sign-out`.
 */
function createHandlers(state: { user: MockUser | null }) {
  const session = () =>
    state.user ? { session: { id: 'ses_1' }, user: state.user } : null;

  return {
    '/sign-up/email': () => ({ body: { token: null, user: ADA } }),
    '/email-otp/verify-email': (request) => {
      if (bodyOf(request).otp !== RIGHT_OTP) {
        return {
          status: 400,
          body: { code: 'INVALID_OTP', message: 'Invalid OTP' },
        };
      }
      state.user = { ...(state.user ?? ADA), emailVerified: true };
      return { body: { status: true, token: 'token', user: state.user } };
    },
    '/email-otp/send-verification-otp': () => ({ body: { success: true } }),
    '/get-session': () => ({ body: session() }),
    '/is-username-available': (request) => ({
      body: { available: bodyOf(request).username !== TAKEN_USERNAME },
    }),
    '/me/username': (request) => {
      const username = bodyOf(request).username;
      if (!state.user || typeof username !== 'string') {
        return {
          status: 401,
          body: {
            statusCode: 401,
            code: 'UNAUTHORIZED',
            message: 'No session',
          },
        };
      }
      state.user = { ...state.user, username: username.toLowerCase() };
      return { body: currentUserOf(state.user) };
    },
    '/sign-out': () => {
      state.user = null;
      return { body: { success: true } };
    },
  } satisfies Record<string, Handler>;
}

// `/v1/auth/get-session` -> `/get-session`, `/v1/me/username` ->
// `/me/username`: the key of the handler that serves it.
const handlerKey = (url: string): string =>
  new URL(url).pathname.replace(/^\/v1(\/auth)?/, '');

/**
 * Serves the API endpoints the auth screens call. `user` is who is signed in
 * at the start (nobody by default); `overrides` replace a path's handler. The
 * returned list records every call.
 */
export async function mockAuthApi(
  page: Page,
  {
    user = null,
    overrides = {},
  }: { user?: MockUser | null; overrides?: Record<string, Handler> } = {},
): Promise<Request[]> {
  const handlers: Record<string, Handler> = {
    ...createHandlers({ user }),
    ...overrides,
  };
  const calls: Request[] = [];

  const serve = async (route: Route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') {
      await fulfill(route, { status: 204, body: null });
      return;
    }
    const handler = handlers[handlerKey(request.url())];
    calls.push(request);
    await fulfill(
      route,
      handler ? handler(request) : { status: 404, body: { code: 'NOT_FOUND' } },
    );
  };
  await page.route(AUTH_ROUTES, serve);
  await page.route(USERNAME_ROUTE, serve);
  return calls;
}
