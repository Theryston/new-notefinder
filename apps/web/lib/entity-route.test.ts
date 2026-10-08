import { describe, expect, it, vi } from 'vitest';

import {
  classifyEntityResponse,
  entityRedirectUrl,
  fetchEntityRouteVerdict,
  parseEntityRoute,
} from './entity-route';

describe('parseEntityRoute', () => {
  it('reads the collection, the locale and the decoded ID of an album', () => {
    expect(parseEntityRoute('/pt-BR/albums/clx789ghi')).toEqual({
      locale: 'pt-BR',
      collection: 'albums',
      id: 'clx789ghi',
    });
  });

  it('reads an artist route the same way', () => {
    expect(parseEntityRoute('/en/artists/clx456def/')).toEqual({
      locale: 'en',
      collection: 'artists',
      id: 'clx456def',
    });
  });

  it('ignores other collections, extra segments and bare paths', () => {
    expect(parseEntityRoute('/en/tracks/clx123abc')).toBeUndefined();
    expect(parseEntityRoute('/en/albums/a/b')).toBeUndefined();
    expect(parseEntityRoute('/albums/clx789ghi')).toBeUndefined();
    expect(parseEntityRoute('/en/albums')).toBeUndefined();
    expect(parseEntityRoute('/en/albums/')).toBeUndefined();
  });

  it('ignores an ID that is not valid percent-encoding', () => {
    expect(parseEntityRoute('/en/albums/%E0%A4%A')).toBeUndefined();
  });
});

describe('entityRedirectUrl', () => {
  it('swaps the trailing ID and keeps the query', () => {
    const url = entityRedirectUrl(
      new URL('https://notefinder.test/en/albums/legacy-1?x=1'),
      'album-1',
    );

    expect(url.pathname).toBe('/en/albums/album-1');
    expect(url.searchParams.get('x')).toBe('1');
  });
});

describe('classifyEntityResponse', () => {
  it('passes a 200 through to the page', () => {
    expect(classifyEntityResponse(200, { id: 'album-1' })).toEqual({
      kind: 'pass',
    });
  });

  it('maps a RESOURCE_MOVED 404 to a redirect', () => {
    expect(
      classifyEntityResponse(404, {
        statusCode: 404,
        code: 'RESOURCE_MOVED',
        message: 'Album moved',
        details: { id: 'album-1' },
      }),
    ).toEqual({ kind: 'moved', newId: 'album-1' });
  });

  it('maps a NOT_FOUND 404 to a real 404', () => {
    expect(
      classifyEntityResponse(404, {
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Album not found',
      }),
    ).toEqual({ kind: 'missing' });
  });
});

describe('fetchEntityRouteVerdict', () => {
  it('asks the versioned endpoint of the collection with the encoded ID', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      status: 200,
      json: () => Promise.resolve({}),
    });

    await fetchEntityRouteVerdict(
      'http://api.test/',
      'albums',
      'album/1',
      fetchFn,
    );

    expect(fetchFn).toHaveBeenCalledWith(
      'http://api.test/v1/albums/album%2F1',
      { signal: expect.any(AbortSignal) },
    );
  });

  it('lets an unreachable API through to the page', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('offline'));

    await expect(
      fetchEntityRouteVerdict('http://api.test', 'albums', 'album-1', fetchFn),
    ).resolves.toEqual({ kind: 'pass' });
  });
});
