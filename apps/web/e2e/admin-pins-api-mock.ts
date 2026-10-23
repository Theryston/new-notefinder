import { homePinPreviewRequestSchema } from '@notefinder/contracts';
import type { Page, Request, Route } from '@playwright/test';

// Any host: the API URL the browser calls is inlined when the app is built
// (`NEXT_PUBLIC_API_URL`), so it depends on the build, not on this suite.
const ADMIN_PINS_ROUTE = '**/v1/admin/home-pins**';
const ADMIN_TRACKS_ROUTE = '**/v1/admin/tracks/search**';

/** A Track as the admin track search answers it. */
export type MockPinTrack = {
  id: string;
  title: string;
  artistCredit: { name: string; joinPhrase: string }[];
  coverUrl: string | null;
};

/** A pin as the admin endpoints answer it. Specs build them by hand. */
export type MockPin = {
  id: string;
  kind: 'hero' | 'row';
  layout: string;
  source: { type: 'tracks'; trackIds: string[] };
  position: number;
  priority: number;
  audience: 'everyone' | 'visitors';
  locale: 'en' | 'pt-BR' | null;
  startsAt: string | null;
  endsAt: string | null;
  titles: { en?: string; 'pt-BR'?: string };
  sponsored: boolean;
  createdBy: { id: string; name: string } | null;
  updatedBy: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
};

export type MockHistoryEntry = {
  id: string;
  pinId: string;
  action: 'CREATED' | 'UPDATED' | 'DELETED';
  changedFields: string[];
  actor: { id: string; name: string } | null;
  state: Omit<
    MockPin,
    'id' | 'createdBy' | 'updatedBy' | 'createdAt' | 'updatedAt'
  >;
  createdAt: string;
};

export const mockPin = (overrides: Partial<MockPin> = {}): MockPin => ({
  id: 'pin_1',
  kind: 'row',
  layout: 'standard',
  source: { type: 'tracks', trackIds: ['trk_a', 'trk_b'] },
  position: 2,
  priority: 0,
  audience: 'everyone',
  locale: null,
  startsAt: null,
  endsAt: null,
  titles: { en: 'Summer picks', 'pt-BR': 'Escolhas de verão' },
  sponsored: false,
  createdBy: { id: 'usr_admin', name: 'Admin' },
  updatedBy: { id: 'usr_admin', name: 'Admin' },
  createdAt: '2026-10-21T12:00:00.000Z',
  updatedAt: '2026-10-21T12:00:00.000Z',
  ...overrides,
});

type Reply = { status?: number; body?: unknown };

const METHODS = 'GET, POST, PATCH, DELETE, OPTIONS';

// The browser calls the API cross-origin with cookies, so every reply
// (preflights included) needs the CORS headers the real API sends.
async function fulfill(route: Route, reply: Reply) {
  const origin = route.request().headers().origin ?? '*';
  if (reply.status === 204) {
    await route.fulfill({
      status: 204,
      headers: {
        'access-control-allow-origin': origin,
        'access-control-allow-credentials': 'true',
        'access-control-allow-headers': 'content-type',
        'access-control-allow-methods': METHODS,
      },
      body: '',
    });
    return;
  }
  await route.fulfill({
    status: reply.status ?? 200,
    headers: {
      'access-control-allow-origin': origin,
      'access-control-allow-credentials': 'true',
      'access-control-allow-headers': 'content-type',
      'access-control-allow-methods': METHODS,
      'content-type': 'application/json',
    },
    body: JSON.stringify(reply.body ?? null),
  });
}

const notFound = { status: 404, body: { code: 'NOT_FOUND' } };

const pinIdOf = (url: string): string | null => {
  const match = /\/v1\/admin\/home-pins\/([^/?]+)/.exec(new URL(url).pathname);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
};

type PinStore = {
  pins: MockPin[];
  nextId: number;
};

const adminActor = { id: 'usr_admin', name: 'Admin' };

const listReply = (store: PinStore): Reply => ({
  body: { items: [...store.pins].reverse(), nextCursor: null },
});

const createReply = (store: PinStore, request: Request): Reply => {
  const body = (request.postDataJSON() ?? {}) as Record<string, unknown>;
  store.nextId += 1;
  const now = new Date().toISOString();
  const pin: MockPin = {
    ...mockPin(),
    ...(body as Partial<MockPin>),
    id: `pin_${store.nextId}`,
    createdBy: adminActor,
    updatedBy: adminActor,
    createdAt: now,
    updatedAt: now,
  };
  store.pins.push(pin);
  return { status: 201, body: pin };
};

const patchReply = (
  store: PinStore,
  pinId: string,
  request: Request,
): Reply => {
  const pin = store.pins.find((candidate) => candidate.id === pinId);
  if (!pin) return notFound;
  const body = (request.postDataJSON() ?? {}) as Record<string, unknown>;
  const updated: MockPin = {
    ...pin,
    ...(body as Partial<MockPin>),
    id: pinId,
    updatedAt: new Date().toISOString(),
  };
  store.pins[store.pins.indexOf(pin)] = updated;
  return { body: updated };
};

const deleteReply = (store: PinStore, pinId: string): Reply => {
  const index = store.pins.findIndex((pin) => pin.id === pinId);
  if (index === -1) return notFound;
  store.pins.splice(index, 1);
  return { status: 204 };
};

/** Serves one admin route pattern, recording every call like the pins do. */
async function routeApi(
  page: Page,
  pattern: string,
  calls: Request[],
  reply: (request: Request) => Reply,
) {
  await page.route(pattern, async (route: Route) => {
    if (route.request().method() === 'OPTIONS') {
      await fulfill(route, { status: 204 });
      return;
    }
    calls.push(route.request());
    await fulfill(route, reply(route.request()));
  });
}

const historyReply = (
  history: Record<string, MockHistoryEntry[]>,
  pinId: string,
): Reply => ({ body: { items: history[pinId] ?? [], nextCursor: null } });

const previewAndMetricsReply = (
  store: PinStore,
  request: Request,
  pathname: string,
): Reply | undefined => {
  if (request.method() === 'GET' && pathname.endsWith('/metrics')) {
    return {
      body: store.pins.map((pin) => ({
        pinId: pin.id,
        impressions: 0,
        clicks: 0,
        clickThroughRate: 0,
      })),
    };
  }
  if (request.method() !== 'POST' || !pathname.endsWith('/preview')) {
    return undefined;
  }
  const preview = homePinPreviewRequestSchema.parse(request.postDataJSON());
  const pin = preview.pin;
  const targetsLocale = pin.locale === null || pin.locale === preview.locale;
  const targetsAudience =
    pin.audience === 'everyone' || preview.audience === 'visitor';
  const ids =
    pin.source.type === 'tracks' ? pin.source.trackIds : ['trk_preview'];
  const items =
    targetsLocale && targetsAudience
      ? ids.map((id) => ({
          id,
          title: 'Preview song',
          coverUrl: 'https://cdn.example/preview.webp',
          artistCredit: [{ name: 'Preview artist', joinPhrase: '' }],
          durationMs: null,
          vocalRange: null,
        }))
      : [];
  const title = pin.titles[preview.locale];
  return {
    body: {
      audience: preview.audience === 'signed-in' ? 'personal' : 'public',
      version: 'preview-version',
      algorithmVersion: 1,
      rows:
        items.length > 0 && title
          ? [
              {
                id: `pin-${preview.pinId ?? 'preview'}`,
                layout: 'standard',
                title: { key: 'home.rows.pinned', params: { title } },
                items,
                sponsored: true,
              },
            ]
          : [],
      nextCursor: null,
    },
  };
};

const routeReply = (
  store: PinStore,
  history: Record<string, MockHistoryEntry[]>,
  request: Request,
): Reply => {
  const pinId = pinIdOf(request.url());
  const pathname = new URL(request.url()).pathname;
  const auxiliaryReply = previewAndMetricsReply(store, request, pathname);
  if (auxiliaryReply) return auxiliaryReply;
  if (request.method() === 'GET' && pinId === null) return listReply(store);
  if (request.method() === 'POST' && pinId === null)
    return createReply(store, request);
  if (pinId && pathname.endsWith('/history') && request.method() === 'GET')
    return historyReply(history, pinId);
  if (pinId && request.method() === 'PATCH')
    return patchReply(store, pinId, request);
  if (pinId && request.method() === 'DELETE') return deleteReply(store, pinId);
  return notFound;
};

const trackReply = (tracks: MockPinTrack[], request: Request): Reply => {
  const url = new URL(request.url());
  const ids = url.searchParams.get('ids');
  if (ids !== null) {
    const wanted = ids.split(',');
    const byId = new Map(tracks.map((track) => [track.id, track]));
    return {
      body: {
        items: wanted.flatMap((id) => {
          const track = byId.get(id);
          return track ? [track] : [];
        }),
      },
    };
  }
  const query = (url.searchParams.get('q') ?? '').toLowerCase();
  const kind = url.searchParams.get('kind');
  const limit = Number(url.searchParams.get('limit') ?? '10');
  return {
    body: {
      items: tracks
        .filter(
          (track) =>
            track.title.toLowerCase().includes(query) ||
            track.artistCredit.some((entry) =>
              entry.name.toLowerCase().includes(query),
            ),
        )
        .filter((track) => kind !== 'hero' || track.coverUrl !== null)
        .slice(0, Number.isFinite(limit) ? limit : 10),
    },
  };
};

/**
 * Serves the admin pins endpoints over an in-memory list (`pins`, newest
 * last), so the panel reads, creates, edits, deletes and opens the history:
 * created pins get `pin_<n>` ids and join the list the panel shows; `calls`
 * records every request, and `pins()` reads the current list. `tracks` backs
 * the track picker search the same way.
 */
export async function mockAdminPinsApi(
  page: Page,
  {
    pins = [],
    history = {},
    tracks = [],
  }: {
    pins?: MockPin[];
    history?: Record<string, MockHistoryEntry[]>;
    tracks?: MockPinTrack[];
  } = {},
): Promise<{ calls: Request[]; pins: () => MockPin[] }> {
  const store: PinStore = {
    pins: pins.map((pin) => ({ ...pin })),
    nextId: pins.length,
  };
  const calls: Request[] = [];

  await routeApi(page, ADMIN_PINS_ROUTE, calls, (request) =>
    routeReply(store, history, request),
  );
  await routeApi(page, ADMIN_TRACKS_ROUTE, calls, (request) =>
    trackReply(tracks, request),
  );

  return { calls, pins: () => [...store.pins] };
}
