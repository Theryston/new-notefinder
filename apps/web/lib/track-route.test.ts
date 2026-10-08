import { describe, expect, it, vi } from 'vitest';

import {
  entityRedirectUrl,
  fetchCatalogRouteVerdict,
  parseCatalogRoute,
  parseTrackRoute,
} from './entity-route';

const jsonReply = (status: number, body: unknown) =>
  vi.fn(async () => ({ status, json: async () => body }));

describe('parseTrackRoute', () => {
  it('reads the locale and the Track ID of a Track page', () => {
    expect(parseTrackRoute('/en/tracks/clx123abc')).toEqual({
      locale: 'en',
      collection: 'tracks',
      id: 'clx123abc',
    });
    expect(parseTrackRoute('/pt-BR/tracks/clx123abc/')).toMatchObject({
      locale: 'pt-BR',
      id: 'clx123abc',
    });
  });

  it.each([
    '/tracks/clx123abc',
    '/fr/tracks/clx123abc',
    '/en/tracks',
    '/en/tracks/',
    '/en/tracks/clx123abc/notes',
    '/en/tracks/%E0%A4%A',
    '/en/artists/clx456def',
  ])('rejects %s', (pathname) => {
    expect(parseTrackRoute(pathname)).toBeUndefined();
  });
});

describe('parseCatalogRoute', () => {
  it('finds the Track, artist and album routes the proxy checks', () => {
    expect(parseCatalogRoute('/en/tracks/clx1')).toMatchObject({
      collection: 'tracks',
    });
    expect(parseCatalogRoute('/en/artists/clx2')).toMatchObject({
      collection: 'artists',
    });
    expect(parseCatalogRoute('/en/albums/clx3')).toMatchObject({
      collection: 'albums',
    });
  });

  it('ignores every other path', () => {
    expect(parseCatalogRoute('/en/search?q=queen')).toBeUndefined();
  });
});

describe('entityRedirectUrl for a Track', () => {
  it('swaps the Track ID and keeps the locale and the query', () => {
    const url = entityRedirectUrl(
      'http://localhost:3000/pt-BR/tracks/old-id?x=1',
      { locale: 'pt-BR', collection: 'tracks', id: 'old-id' },
      'new-id',
    );

    expect(url.pathname).toBe('/pt-BR/tracks/new-id');
    expect(url.search).toBe('?x=1');
  });
});

describe('fetchCatalogRouteVerdict for a Track', () => {
  const route = {
    locale: 'en' as const,
    collection: 'tracks' as const,
    id: 'a b',
  };

  it('checks the Processing endpoint of the Track', async () => {
    const fetchFn = jsonReply(200, {});

    await fetchCatalogRouteVerdict('https://api.test/', route, fetchFn);

    expect(fetchFn).toHaveBeenCalledWith(
      'https://api.test/v1/tracks/a%20b/processing',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('turns a legacy Track ID into a move to its new ID', async () => {
    const verdict = await fetchCatalogRouteVerdict(
      'https://api.test',
      route,
      jsonReply(404, {
        statusCode: 404,
        code: 'RESOURCE_MOVED',
        message: 'Track moved',
        details: { id: 'track-new' },
      }),
    );

    expect(verdict).toEqual({ kind: 'moved', newId: 'track-new' });
  });

  it('turns an unknown Track ID into a missing verdict', async () => {
    const verdict = await fetchCatalogRouteVerdict(
      'https://api.test',
      route,
      jsonReply(404, {
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Track not found',
      }),
    );

    expect(verdict).toEqual({ kind: 'missing' });
  });

  it('lets a found Track through to the page', async () => {
    const verdict = await fetchCatalogRouteVerdict(
      'https://api.test',
      route,
      jsonReply(200, {}),
    );

    expect(verdict).toEqual({ kind: 'pass' });
  });

  it('lets the page render its own outcome when the API cannot be reached', async () => {
    const verdict = await fetchCatalogRouteVerdict(
      'https://api.test',
      route,
      vi.fn(async () => {
        throw new Error('connection refused');
      }),
    );

    expect(verdict).toEqual({ kind: 'pass' });
  });
});
