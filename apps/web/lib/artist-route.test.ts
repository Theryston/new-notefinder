import { describe, expect, it } from 'vitest';

import {
  artistRedirectUrl,
  classifyArtistResponse,
  fetchArtistRouteVerdict,
  parseArtistRoute,
} from './artist-route';

describe('parseArtistRoute', () => {
  it.each(['en', 'pt-BR'] as const)('parses /%s/artists/<id>', (locale) => {
    expect(parseArtistRoute(`/${locale}/artists/clx456def`)).toEqual({
      locale,
      artistId: 'clx456def',
    });
  });

  it('accepts a trailing slash and decodes the ID', () => {
    expect(parseArtistRoute('/en/artists/clx456def/')).toEqual({
      locale: 'en',
      artistId: 'clx456def',
    });
    expect(parseArtistRoute('/en/artists/a%20b')).toEqual({
      locale: 'en',
      artistId: 'a b',
    });
  });

  it.each([
    '/',
    '/en',
    '/en/artists',
    '/en/artists/',
    '/en/artists/a/b',
    '/en/tracks/clx123',
    '/fr/artists/clx456def',
    '/artists/clx456def',
    '/en/artists/%E0%A4%A',
  ])('rejects %s', (pathname) => {
    expect(parseArtistRoute(pathname)).toBeUndefined();
  });
});

describe('artistRedirectUrl', () => {
  it('swaps the ID and keeps locale, path and query', () => {
    const url = artistRedirectUrl(
      new URL('http://localhost:3000/en/artists/legacy-1?x=1&y=2'),
      'artist-1',
    );

    expect(url.pathname).toBe('/en/artists/artist-1');
    expect(url.search).toBe('?x=1&y=2');
  });

  it('encodes the new ID', () => {
    const url = artistRedirectUrl(
      new URL('http://localhost:3000/en/artists/legacy-1'),
      'a/b',
    );

    expect(url.pathname).toBe('/en/artists/a%2Fb');
  });
});

describe('classifyArtistResponse', () => {
  it('passes everything but a 404 through to the page', () => {
    expect(classifyArtistResponse(200, { id: 'artist-1' })).toEqual({
      kind: 'pass',
    });
    expect(
      classifyArtistResponse(500, {
        statusCode: 500,
        code: 'INTERNAL_ERROR',
        message: 'Broken',
      }),
    ).toEqual({ kind: 'pass' });
  });

  it('maps RESOURCE_MOVED with the new ID to a redirect', () => {
    expect(
      classifyArtistResponse(404, {
        statusCode: 404,
        code: 'RESOURCE_MOVED',
        message: 'Artist moved',
        details: { id: 'artist-1' },
      }),
    ).toEqual({ kind: 'moved', newId: 'artist-1' });
  });

  it('maps a valid NOT_FOUND envelope to a real 404', () => {
    expect(
      classifyArtistResponse(404, {
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Artist not found',
      }),
    ).toEqual({ kind: 'missing' });
  });

  it.each([
    ['an unparsable body', { unexpected: 'shape' }],
    [
      'moved details without an ID',
      {
        statusCode: 404,
        code: 'RESOURCE_MOVED',
        message: 'Artist moved',
        details: { id: '' },
      },
    ],
  ])('lets %s through instead of inventing a 404', (_label, body) => {
    expect(classifyArtistResponse(404, body)).toEqual({ kind: 'pass' });
  });
});

describe('fetchArtistRouteVerdict', () => {
  const movedBody = {
    statusCode: 404,
    code: 'RESOURCE_MOVED',
    message: 'Artist moved',
    details: { id: 'artist-1' },
  };

  const reply = (status: number, body: unknown) => async (input: string) => {
    expect(input).toBe('https://api.test/v1/artists/legacy-1');
    return { status, json: async () => body };
  };

  it('asks the versioned endpoint with the encoded ID', async () => {
    const seen: string[] = [];
    await fetchArtistRouteVerdict(
      'https://api.test/',
      'a/b',
      async (input: string) => {
        seen.push(input);
        return { status: 200, json: async () => ({}) };
      },
    );

    expect(seen).toEqual(['https://api.test/v1/artists/a%2Fb']);
  });

  it('maps a legacy ID to its redirect', async () => {
    await expect(
      fetchArtistRouteVerdict(
        'https://api.test',
        'legacy-1',
        reply(404, movedBody),
      ),
    ).resolves.toEqual({ kind: 'moved', newId: 'artist-1' });
  });

  it('maps an unknown ID to a real 404', async () => {
    await expect(
      fetchArtistRouteVerdict('https://api.test', 'legacy-1', async () => ({
        status: 404,
        json: async () => ({
          statusCode: 404,
          code: 'NOT_FOUND',
          message: 'Artist not found',
        }),
      })),
    ).resolves.toEqual({ kind: 'missing' });
  });

  it.each([
    ['a 200', 200, { id: 'artist-1' }],
    ['a 500', 500, { code: 'INTERNAL_ERROR' }],
  ])('lets %s through to the page', async (_label, status, body) => {
    const fetchFn = async () => ({
      status,
      json: async () => body,
    });

    await expect(
      fetchArtistRouteVerdict('https://api.test', 'legacy-1', fetchFn),
    ).resolves.toEqual({ kind: 'pass' });
  });

  it('lets an unparsable 404 body through to the page', async () => {
    const fetchFn = async () => ({
      status: 404,
      json: async (): Promise<unknown> => {
        throw new Error('not JSON');
      },
    });

    await expect(
      fetchArtistRouteVerdict('https://api.test', 'legacy-1', fetchFn),
    ).resolves.toEqual({ kind: 'pass' });
  });

  it('lets a timeout through to the page', async () => {
    const fetchFn = async () => {
      throw new Error('aborted');
    };

    await expect(
      fetchArtistRouteVerdict('https://api.test', 'legacy-1', fetchFn),
    ).resolves.toEqual({ kind: 'pass' });
  });
});
