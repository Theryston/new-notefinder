import { describe, expect, it, vi } from 'vitest';

import {
  entityRedirectUrl,
  fetchEntityRouteVerdict,
  parseEntityRoute,
} from './entity-route';

// The rules for both catalog collections. The artist cases are the ones the
// retired artist-route tests asserted; each has its album twin next to it.
describe('parseEntityRoute', () => {
  it.each(['en', 'pt-BR'] as const)(
    'parses /%s/artists/<id> and /%s/albums/<id>',
    (locale) => {
      expect(parseEntityRoute(`/${locale}/artists/clx456def`)).toEqual({
        locale,
        collection: 'artists',
        id: 'clx456def',
      });
      expect(parseEntityRoute(`/${locale}/albums/clx789ghi`)).toEqual({
        locale,
        collection: 'albums',
        id: 'clx789ghi',
      });
    },
  );

  it('accepts a trailing slash and decodes the ID', () => {
    expect(parseEntityRoute('/en/artists/clx456def/')).toEqual({
      locale: 'en',
      collection: 'artists',
      id: 'clx456def',
    });
    expect(parseEntityRoute('/en/artists/a%20b')).toEqual({
      locale: 'en',
      collection: 'artists',
      id: 'a b',
    });
    expect(parseEntityRoute('/en/albums/a%20b')).toEqual({
      locale: 'en',
      collection: 'albums',
      id: 'a b',
    });
  });

  it.each([
    '/',
    '/en',
    '/en/artists',
    '/en/artists/',
    '/en/artists/a/b',
    '/en/albums',
    '/en/albums/',
    '/en/albums/a/b',
    '/en/tracks/clx123',
    '/fr/artists/clx456def',
    '/fr/albums/clx789ghi',
    '/artists/clx456def',
    '/albums/clx789ghi',
    '/en/artists/%E0%A4%A',
    '/en/albums/%E0%A4%A',
  ])('rejects %s', (pathname) => {
    expect(parseEntityRoute(pathname)).toBeUndefined();
  });
});

describe('entityRedirectUrl', () => {
  it('swaps the artist ID and keeps locale, collection and query', () => {
    const url = entityRedirectUrl(
      'http://localhost:3000/en/artists/legacy-1?x=1&y=2',
      { locale: 'en', collection: 'artists', id: 'legacy-1' },
      'artist-1',
    );

    expect(url.pathname).toBe('/en/artists/artist-1');
    expect(url.search).toBe('?x=1&y=2');
  });

  it('swaps the album ID and keeps locale, collection and query', () => {
    const url = entityRedirectUrl(
      'http://localhost:3000/pt-BR/albums/legacy-1?x=1',
      { locale: 'pt-BR', collection: 'albums', id: 'legacy-1' },
      'album-1',
    );

    expect(url.pathname).toBe('/pt-BR/albums/album-1');
    expect(url.search).toBe('?x=1');
  });

  it('encodes the new ID', () => {
    const url = entityRedirectUrl(
      'http://localhost:3000/en/artists/legacy-1',
      { locale: 'en', collection: 'artists', id: 'legacy-1' },
      'a/b',
    );

    expect(url.pathname).toBe('/en/artists/a%2Fb');
  });
});

describe('fetchEntityRouteVerdict', () => {
  const movedBody = {
    statusCode: 404,
    code: 'RESOURCE_MOVED',
    message: 'Moved',
    details: { id: 'new-1' },
  };

  const reply = (status: number, body: unknown) => async (input: string) => {
    expect(input).toBe('https://api.test/v1/artists/legacy-1');
    return { status, json: async () => body };
  };

  it.each(['artists', 'albums'] as const)(
    'asks the versioned %s endpoint with the encoded ID',
    async (collection) => {
      const seen: string[] = [];
      await fetchEntityRouteVerdict(
        'https://api.test/',
        collection,
        'a/b',
        async (input: string) => {
          seen.push(input);
          return { status: 200, json: async () => ({}) };
        },
      );

      expect(seen).toEqual([`https://api.test/v1/${collection}/a%2Fb`]);
    },
  );

  it('maps a legacy artist ID to its redirect', async () => {
    await expect(
      fetchEntityRouteVerdict(
        'https://api.test',
        'artists',
        'legacy-1',
        reply(404, movedBody),
      ),
    ).resolves.toEqual({ kind: 'moved', newId: 'new-1' });
  });

  it('maps a legacy album ID to its redirect', async () => {
    await expect(
      fetchEntityRouteVerdict(
        'https://api.test',
        'albums',
        'legacy-1',
        async () => ({ status: 404, json: async () => movedBody }),
      ),
    ).resolves.toEqual({ kind: 'moved', newId: 'new-1' });
  });

  it.each(['artists', 'albums'] as const)(
    'maps an unknown %s ID to a real 404',
    async (collection) => {
      await expect(
        fetchEntityRouteVerdict(
          'https://api.test',
          collection,
          'legacy-1',
          async () => ({
            status: 404,
            json: async () => ({
              statusCode: 404,
              code: 'NOT_FOUND',
              message: 'Not found',
            }),
          }),
        ),
      ).resolves.toEqual({ kind: 'missing' });
    },
  );

  it.each([
    ['a 200', 200, { id: 'artist-1' }],
    ['a 500', 500, { code: 'INTERNAL_ERROR' }],
  ])('lets %s through to the page', async (_label, status, body) => {
    await expect(
      fetchEntityRouteVerdict(
        'https://api.test',
        'artists',
        'legacy-1',
        async () => ({
          status,
          json: async () => body,
        }),
      ),
    ).resolves.toEqual({ kind: 'pass' });
  });

  it('lets an unparsable 404 body through to the page', async () => {
    await expect(
      fetchEntityRouteVerdict(
        'https://api.test',
        'artists',
        'legacy-1',
        async () => ({
          status: 404,
          json: async (): Promise<unknown> => {
            throw new Error('not JSON');
          },
        }),
      ),
    ).resolves.toEqual({ kind: 'pass' });
  });

  it.each([
    ['an unexpected shape', { unexpected: 'shape' }],
    ['moved details without an ID', { ...movedBody, details: { id: '' } }],
  ])(
    'lets a 404 with %s through instead of inventing a verdict',
    async (_label, body) => {
      await expect(
        fetchEntityRouteVerdict(
          'https://api.test',
          'artists',
          'legacy-1',
          async () => ({
            status: 404,
            json: async () => body,
          }),
        ),
      ).resolves.toEqual({ kind: 'pass' });
    },
  );

  it('lets a timeout or a network failure through to the page', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('aborted'));

    await expect(
      fetchEntityRouteVerdict(
        'https://api.test',
        'artists',
        'legacy-1',
        fetchFn,
      ),
    ).resolves.toEqual({ kind: 'pass' });
  });
});
