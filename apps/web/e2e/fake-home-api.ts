import type { IncomingMessage, ServerResponse } from 'node:http';

import { json, readBody } from './fake-api-http.ts';

/**
 * `GET /v1/home` of the fake API: one feed per locale, paged six rows at a
 * time like the real endpoint. Specs install a feed with
 * {@link setHomeMock}, which also bumps the feed's version, so a cursor from
 * an earlier fixture is refused the way an expired one is. A request carrying
 * a session cookie gets the personal feed when one is installed (falling back
 * to the public rows with a personal audience), mirroring the real API.
 */

const PAGE_SIZE = 6;

/** The session cookie the web forwards, like the real Better Auth one. */
const SESSION_COOKIE = 'notefinder.session_token=';

type FakeHomeLocale = 'en' | 'pt-BR';

/** A row as the feed sends it; specs build them, the fake only pages them. */
export type FakeHomeRow = Record<string, unknown> & { id: string };

type HomeMockState = {
  feeds?: Partial<Record<FakeHomeLocale, FakeHomeRow[]>>;
  /** The signed-in feed of each locale given; the rest fall back to `feeds`. */
  personal?: Partial<Record<FakeHomeLocale, FakeHomeRow[]>>;
};

const feeds = new Map<
  FakeHomeLocale,
  { version: string; rows: FakeHomeRow[] }
>();

const personalFeeds = new Map<
  FakeHomeLocale,
  { version: string; rows: FakeHomeRow[] }
>();

/** Every installed feed, with the audience it serves as. */
const installedFeeds = function* (): Generator<{
  audience: 'public' | 'personal';
  version: string;
  rows: FakeHomeRow[];
}> {
  for (const feed of feeds.values()) {
    yield { audience: 'public', ...feed };
  }
  for (const feed of personalFeeds.values()) {
    yield { audience: 'personal', ...feed };
  }
};

/** The feed a cursor names, personal or public, if still installed. */
const feedOfVersion = (version: string | undefined) => {
  if (!version) return undefined;
  for (const feed of installedFeeds()) {
    if (feed.version === version) return feed;
  }
  return undefined;
};

let versionCounter = 0;

const installFeed = (
  store: Map<FakeHomeLocale, { version: string; rows: FakeHomeRow[] }>,
  locale: FakeHomeLocale,
  rows: FakeHomeRow[],
): void => {
  versionCounter += 1;
  store.set(locale, { version: `fixture-${versionCounter}`, rows });
};

const fixtureTrack = (id: string, title: string) => ({
  id,
  title,
  coverUrl: null,
  artistCredit: [{ name: 'NoteFinder', joinPhrase: '' }],
  durationMs: 180000,
  vocalRange: { lowest: 45, highest: 64 },
});

/**
 * The feed a locale serves until a spec installs its own. Like production, it
 * is never empty: a hero and five carousels, tall enough that the page scrolls
 * (the header's hide-on-scroll behaviour depends on that).
 */
export const defaultHomeRows = (locale: FakeHomeLocale): FakeHomeRow[] => {
  const hero = {
    id: 'hero',
    layout: 'hero',
    track: fixtureTrack(`default-${locale}-hero`, 'Default hero song'),
  };
  const carousels = Array.from({ length: 5 }, (_, row) => ({
    id: `default-row-${row}`,
    layout: 'standard',
    title: {
      key: row % 2 ? 'home.rows.newTracks' : 'home.rows.trendingToday',
      params: {},
    },
    items: Array.from({ length: 6 }, (_, item) =>
      fixtureTrack(
        `default-${locale}-${row}-${item}`,
        `Default song ${row}-${item}`,
      ),
    ),
  }));
  return [hero, ...carousels];
};

installFeed(feeds, 'en', defaultHomeRows('en'));
installFeed(feeds, 'pt-BR', defaultHomeRows('pt-BR'));

const isLocale = (value: string): value is FakeHomeLocale =>
  value === 'en' || value === 'pt-BR';

/** `<version>.<offset>`: the offset of the next row of that version. */
const parseCursor = (
  cursor: string,
): { version: string; offset: number } | undefined => {
  const match = /^(.+)\.(\d+)$/.exec(cursor);
  if (!match?.[1] || !match[2]) return undefined;
  return { version: match[1], offset: Number(match[2]) };
};

const serveHome = (request: IncomingMessage, response: ServerResponse) => {
  const search = new URL(request.url ?? '/', 'http://fake.local').searchParams;
  const requested = search.get('locale') ?? 'en';
  const locale: FakeHomeLocale = isLocale(requested) ? requested : 'en';
  const cursor = search.get('cursor');
  // A cursor names its own feed version, so it ignores the locale and the
  // session: a personal cursor resumes the personal feed, like the real API
  // resolves a snapshot version before falling back to the public one.
  const byCursor = cursor
    ? feedOfVersion(parseCursor(cursor)?.version)
    : undefined;
  const signedIn = (request.headers.cookie ?? '').includes(SESSION_COOKIE);
  const audience = byCursor?.audience ?? (signedIn ? 'personal' : 'public');
  // Without its own fixture, the personal feed is the public rows with the
  // personal audience, like the real API serves a missing snapshot.
  const feed =
    byCursor ??
    (signedIn ? personalFeeds.get(locale) : undefined) ??
    feeds.get(locale);
  let offset = 0;
  if (cursor) {
    const parsed = parseCursor(cursor);
    if (!parsed || parsed.version !== feed?.version) {
      json(
        response,
        404,
        {
          statusCode: 404,
          code: 'NOT_FOUND',
          message: 'Feed version expired',
          details: { reason: 'FEED_VERSION_EXPIRED' },
        },
        request,
      );
      return Promise.resolve();
    }
    offset = parsed.offset;
  }
  if (!feed) {
    json(response, 500, { statusCode: 500, code: 'INTERNAL_ERROR' }, request);
    return Promise.resolve();
  }

  const next = offset + PAGE_SIZE;
  json(
    response,
    200,
    {
      audience,
      version: feed.version,
      algorithmVersion: 1,
      rows: feed.rows.slice(offset, next),
      nextCursor: next < feed.rows.length ? `${feed.version}.${next}` : null,
    },
    request,
  );
  return Promise.resolve();
};

const serveHomeMockSet = async (
  request: IncomingMessage,
  response: ServerResponse,
) => {
  const state = (await readBody(request)) as HomeMockState;
  for (const locale of ['en', 'pt-BR'] as const) {
    const rows = state.feeds?.[locale];
    if (rows) installFeed(feeds, locale, rows);
    const personal = state.personal?.[locale];
    if (personal) installFeed(personalFeeds, locale, personal);
  }
  json(response, 200, { ok: true }, request);
};

/** The home routes of the fake API, in the router's route-table shape. */
export const homeRoutes = [
  {
    method: 'GET',
    pathname: '/v1/home',
    serve: serveHome,
  },
  {
    method: 'POST',
    pathname: '/__home-mock/set',
    serve: serveHomeMockSet,
  },
];

/**
 * Installs the feed of each locale given (the others stay as they were). The
 * web's cache is cleared with the revalidation endpoint by the caller.
 */
export const setHomeMock = async (
  state: HomeMockState,
  baseUrl = 'http://127.0.0.1:3333',
): Promise<void> => {
  const response = await fetch(`${baseUrl}/__home-mock/set`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(state),
  });
  if (!response.ok) {
    throw new Error(`setHomeMock failed with ${response.status}`);
  }
};
