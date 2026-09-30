import { useTestServer } from './utils/create-test-server.js';
import { setBootstrapState } from './utils/database.js';
import { requestSearch } from './utils/search-client.js';
import { useReadyCatalog } from './utils/use-ready-catalog.js';
import { useTestClient } from './utils/use-test-client.js';

describe('search: requests (e2e)', () => {
  const server = useTestServer();
  const client = useTestClient(server);

  describe('before the first import has finished', () => {
    it('answers CATALOG_NOT_READY when the import has not recorded anything yet', async () => {
      const response = await requestSearch(client(), { query: 'yesterday' });

      expect(response).toMatchObject({
        ok: false,
        error: { code: 'CATALOG_NOT_READY' },
      });
    });

    it.each(['restoring', 'restored', 'indexing'] as const)(
      'answers CATALOG_NOT_READY in the %s phase',
      async (phase) => {
        await setBootstrapState(server().db, { phase, dataset: 'sample' });

        const response = await requestSearch(client(), { query: 'yesterday' });

        expect(response).toMatchObject({
          ok: false,
          error: { code: 'CATALOG_NOT_READY' },
        });
      },
    );

    it('checks the payload first: a bad one is VALIDATION_FAILED, not CATALOG_NOT_READY', async () => {
      const response = await requestSearch(client(), { query: '   ' });

      expect(response).toMatchObject({
        ok: false,
        error: { code: 'VALIDATION_FAILED' },
      });
    });
  });

  describe('once the catalog is ready', () => {
    useReadyCatalog(server);

    it.each([
      ['no payload', undefined],
      ['an empty payload', {}],
      ['no query', { limit: 5 }],
      ['an empty query', { query: '' }],
      ['a query of blanks', { query: ' \t\n ' }],
      ['a query that is not text', { query: 42 }],
      ['a query longer than 256 characters', { query: 'a'.repeat(257) }],
      ['an unknown scope', { query: 'song', scope: 'everything' }],
      ['a limit of 0', { query: 'song', limit: 0 }],
      ['a limit above 100', { query: 'song', limit: 101 }],
      ['a limit with decimals', { query: 'song', limit: 2.5 }],
      ['a negative offset', { query: 'song', offset: -1 }],
      ['an offset above 900', { query: 'song', offset: 901 }],
      ['an offset that is not a number', { query: 'song', offset: '10' }],
    ])(
      'answers VALIDATION_FAILED for %s and keeps the connection open',
      async (_label, payload) => {
        const response = await requestSearch(client(), payload);

        expect(response).toMatchObject({
          ok: false,
          error: { code: 'VALIDATION_FAILED' },
        });
        expect(client().isOpen).toBe(true);
        const status = await client().request('status');
        expect(status).toMatchObject({ ok: true });
      },
    );

    it('accepts the biggest page at the deepest offset', async () => {
      const response = await requestSearch(client(), {
        query: 'song',
        scope: 'lyrics',
        limit: 100,
        offset: 900,
      });

      expect(response).toMatchObject({ ok: true });
    });

    it('answers no results for the lyrics scope until Lyrics are imported', async () => {
      const response = await requestSearch(client(), {
        query: 'yesterday all my troubles',
        scope: 'lyrics',
      });

      expect(response).toEqual({
        id: expect.any(String),
        ok: true,
        result: { results: [] },
      });
    });
  });
});
