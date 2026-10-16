import type {
  PracticePreferences,
  SubmitPracticeAttemptBody,
} from '@notefinder/contracts';
import type { Page, Route } from '@playwright/test';

/**
 * The practice routes the page calls: `POST /v1/tracks/:trackId/attempts`,
 * `GET /v1/me/tracks/:trackId` and `GET`/`PATCH /v1/me/practice-preferences`.
 * Served by the page, since they are session-dependent and the fake API has
 * no sessions of its own. Any host: the API URL the browser calls is inlined
 * when the app is built.
 */
const ATTEMPT_ROUTES = '**/v1/tracks/*/attempts';
const STATE_ROUTES = '**/v1/me/tracks/**';
const PREFERENCES_ROUTES = '**/v1/me/practice-preferences';

export type AttemptsApi = {
  /** The runs the page submitted, in order. */
  attempts: { trackId: string; body: SubmitPracticeAttemptBody }[];
  /** The preference patches the page sent, in order. */
  patches: unknown[];
  /** What the account holds now. */
  preferences: PracticePreferences;
};

const trackIdOf = (route: Route): string =>
  decodeURIComponent(
    new URL(route.request().url()).pathname.split('/').at(-2) ?? '',
  );

const stateIdOf = (route: Route): string =>
  decodeURIComponent(
    new URL(route.request().url()).pathname.split('/').pop() ?? '',
  );

async function fulfill(route: Route, status: number, body: unknown) {
  const request = route.request();
  await route.fulfill({
    status,
    headers: {
      'access-control-allow-origin': request.headers().origin ?? '*',
      'access-control-allow-credentials': 'true',
      'access-control-allow-headers': 'content-type',
      'access-control-allow-methods': 'GET, POST, PATCH, OPTIONS',
      'content-type': 'application/json',
    },
    body: body === null ? '' : JSON.stringify(body),
  });
}

/**
 * Serves the attempt and preference routes over in-memory state, so the page
 * behaves as if the account saved everything.
 */
export async function mockAttemptsApi(
  page: Page,
  {
    preferences: initial = {},
  }: { preferences?: Partial<PracticePreferences> } = {},
): Promise<AttemptsApi> {
  const api: AttemptsApi = {
    attempts: [],
    patches: [],
    preferences: {
      difficulty: 'NORMAL',
      octaveMode: 'ANY',
      guideMelody: false,
      countIn: true,
      ...initial,
    },
  };

  await page.route(ATTEMPT_ROUTES, async (route) => {
    if (route.request().method() === 'OPTIONS')
      return fulfill(route, 204, null);
    const trackId = trackIdOf(route);
    const body = route.request().postDataJSON() as SubmitPracticeAttemptBody;
    api.attempts.push({ trackId, body });
    return fulfill(route, 201, {
      ...body,
      id: `attempt-${api.attempts.length}`,
      trackId,
      createdAt: new Date().toISOString(),
    });
  });
  await page.route(STATE_ROUTES, async (route) => {
    if (route.request().method() === 'OPTIONS')
      return fulfill(route, 204, null);
    const trackId = stateIdOf(route);
    const bestScores = { EASY: null, NORMAL: null, HARD: null } as {
      EASY: number | null;
      NORMAL: number | null;
      HARD: number | null;
    };
    for (const attempt of api.attempts) {
      if (attempt.trackId !== trackId) continue;
      const { difficulty, accuracy } = attempt.body;
      if (
        bestScores[difficulty] === null ||
        accuracy > (bestScores[difficulty] ?? 0)
      ) {
        bestScores[difficulty] = accuracy;
      }
    }
    return fulfill(route, 200, { isFavorite: false, bestScores });
  });
  await page.route(PREFERENCES_ROUTES, async (route) => {
    const method = route.request().method();
    if (method === 'OPTIONS') return fulfill(route, 204, null);
    if (method === 'PATCH') {
      const patch = route
        .request()
        .postDataJSON() as Partial<PracticePreferences>;
      api.patches.push(patch);
      api.preferences = { ...api.preferences, ...patch };
    }
    return fulfill(route, 200, api.preferences);
  });
  return api;
}
