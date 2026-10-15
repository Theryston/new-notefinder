import type { Page, Route } from '@playwright/test';

/**
 * The routes the streak ring calls: `GET /v1/me/streak` and
 * `POST /v1/me/streak/heartbeat`. Served by the page over an in-memory day,
 * since they are session-dependent and the fake API has no sessions of its
 * own. Any host: the API URL the browser calls is inlined at build time.
 */
const STREAK_ROUTES = '**/v1/me/streak**';
const MAX_CREDIT_SECONDS = 20;

type StreakApiOptions = {
  /** The daily target in seconds. */
  targetSeconds?: number;
  /** Seconds already practiced today. */
  listenedSeconds?: number;
  /** Days of streak behind today. */
  streakDays?: number;
};

type HeartbeatRequest = { elapsedSeconds: number; timeZone: string };

export type StreakApi = {
  /** The heartbeats the page sent, in order. */
  heartbeats: HeartbeatRequest[];
};

async function fulfill(route: Route, status: number, body: unknown) {
  const request = route.request();
  await route.fulfill({
    status,
    headers: {
      'access-control-allow-origin': request.headers().origin ?? '*',
      'access-control-allow-credentials': 'true',
      'access-control-allow-headers': 'content-type',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'content-type': 'application/json',
    },
    body: body === null ? '' : JSON.stringify(body),
  });
}

/** Serves the streak routes of a signed-in User over one practice day. */
export async function mockStreakApi(
  page: Page,
  {
    targetSeconds = 300,
    listenedSeconds = 0,
    streakDays = 0,
  }: StreakApiOptions = {},
): Promise<StreakApi> {
  const api: StreakApi = { heartbeats: [] };
  let listened = listenedSeconds;
  let completed = listened >= targetSeconds;

  const status = () => ({
    day: '2026-03-10',
    listenedSeconds: Math.min(listened, targetSeconds),
    targetSeconds,
    completedToday: completed,
    currentStreakDays: completed ? streakDays + 1 : streakDays,
  });

  await page.route(STREAK_ROUTES, async (route) => {
    const method = route.request().method();
    if (method === 'OPTIONS') return fulfill(route, 204, null);
    if (method === 'GET') return fulfill(route, 200, status());

    const body = route.request().postDataJSON() as HeartbeatRequest;
    api.heartbeats.push(body);
    const creditedSeconds = Math.min(
      MAX_CREDIT_SECONDS,
      Math.floor(body.elapsedSeconds),
    );
    listened += creditedSeconds;
    const justCompleted = !completed && listened >= targetSeconds;
    completed = completed || justCompleted;
    return fulfill(route, 200, {
      status: status(),
      justCompleted,
      creditedSeconds,
    });
  });
  return api;
}
