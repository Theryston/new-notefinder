import { searchResultSchema } from '@notefinder/contracts';
import { createTestApp, type TestApp } from './utils/create-test-app.js';
import { testMbid } from './utils/factories.js';
import {
  FAKE_CATALOG_API_KEY,
  type FakeMusicCatalog,
  startFakeMusicCatalog,
} from './utils/fake-music-catalog.js';
import { recordingSummary } from './utils/recording-summaries.js';

// End-to-end unauthenticated search through the API over one persistent
// Music catalog WebSocket: the API multiplexes queries by request id and
// returns the catalog order untouched, every hit unlinked (`trackId: null`
// until issue #95 looks hits up in the tracks table).
describe('Search passthrough (e2e)', () => {
  let catalog: FakeMusicCatalog;
  let testApp: TestApp;

  beforeAll(async () => {
    catalog = await startFakeMusicCatalog((payload) => {
      const query = String(payload.query ?? '');
      if (query === 'slow') {
        return { delayMs: 1_000, result: { results: [] } };
      }
      if (query.startsWith('concurrent-')) {
        // Later queries answer first, so the API must route by id instead
        // of arrival order.
        const index = Number(query.split('-')[1] ?? 0);
        return {
          delayMs: (5 - index) * 20,
          result: {
            results: [
              {
                ...recordingSummary(testMbid(index + 1), `Song ${index}`),
                primaryRelease: {
                  mbid: testMbid(10 + index),
                  title: `Release ${index}`,
                  year: 2020,
                  coverArtUrl:
                    'https://coverartarchive.org/release/test/front-500',
                },
              },
            ],
          },
        };
      }
      return {
        result: {
          results: [
            {
              ...recordingSummary(testMbid(1), 'First Song'),
              primaryRelease: {
                mbid: testMbid(11),
                title: 'First Release',
                year: 2020,
                coverArtUrl:
                  'https://coverartarchive.org/release/test/front-500',
              },
            },
            recordingSummary(testMbid(2), 'Second Song'),
          ],
        },
      };
    });
    testApp = await createTestApp({
      env: {
        MUSIC_CATALOG_URL: catalog.url,
        MUSIC_CATALOG_API_KEY: FAKE_CATALOG_API_KEY,
        MUSIC_CATALOG_REQUEST_TIMEOUT_MS: 200,
      },
    });
  });

  afterAll(async () => {
    await testApp.close();
    await catalog.close();
  });

  it('returns the catalog hits in order, every hit unlinked', async () => {
    const response = await testApp.http
      .get('/v1/search')
      .query({ query: 'queen' })
      .expect(200);

    expect(searchResultSchema.parse(response.body)).toEqual(response.body);
    expect(
      response.body.results.map((item: { title: string }) => item.title),
    ).toEqual(['First Song', 'Second Song']);
    expect(
      response.body.results.map((item: { trackId: unknown }) => item.trackId),
    ).toEqual([null, null]);
    expect(response.body.results[0].primaryRelease.coverArtUrl).toContain(
      'https://',
    );
  });

  it('needs no authentication', async () => {
    await testApp.http.get('/v1/search').query({ query: 'queen' }).expect(200);
    expect(catalog.seenAuth).toEqual(
      expect.arrayContaining([`Bearer ${FAKE_CATALOG_API_KEY}`]),
    );
  });

  it('forwards scope and paging to the catalog', async () => {
    const response = await testApp.http
      .get('/v1/search')
      .query({ query: 'queen', scope: 'lyrics', limit: '10', offset: '5' })
      .expect(200);

    expect(response.body.results).toHaveLength(2);
  });

  it.each([
    { query: '   ' },
    { query: '', scope: 'metadata' },
    { query: 'queen', scope: 'karaoke' },
    { query: 'queen', limit: '0' },
    { query: 'queen', limit: '101' },
    { query: 'queen', offset: '-1' },
  ])('rejects the invalid query %j with VALIDATION_FAILED', async (query) => {
    const response = await testApp.http
      .get('/v1/search')
      .query(query)
      .expect(400);

    expect(response.body).toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      details: expect.objectContaining({ location: 'query' }),
    });
  });

  it('fails a slow catalog search instead of hanging', async () => {
    const response = await testApp.http
      .get('/v1/search')
      .query({ query: 'slow' })
      .expect(500);

    expect(response.body).toMatchObject({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
    });
  });

  it('multiplexes concurrent searches with out-of-order answers', async () => {
    const responses = await Promise.all(
      [0, 1, 2, 3, 4].map((index) =>
        testApp.http
          .get('/v1/search')
          .query({ query: `concurrent-${index}` })
          .expect(200),
      ),
    );

    for (const [index, response] of responses.entries()) {
      expect(
        response.body.results.map((item: { title: string }) => item.title),
      ).toEqual([`Song ${index}`]);
    }
  });
});
