import {
  musicCatalogSearchPayloadSchema,
  searchQuerySchema,
  searchResultItemSchema,
} from '@notefinder/contracts';
import { testMbid } from '../../../test/utils/factories.js';
import { recordingSummary } from '../../../test/utils/recording-summaries.js';

// Locks the shared vocabulary: the public query mirrors the Music catalog
// payload semantics (same scope, defaults and bounds), and each enriched hit
// is the catalog's summary plus a nullable Track id.
describe('search contracts', () => {
  it('parses the public query with the catalog defaults', () => {
    expect(searchQuerySchema.parse({ query: 'queen' })).toEqual(
      musicCatalogSearchPayloadSchema.parse({ query: 'queen' }),
    );
  });

  it('accepts the lyrics scope with paging from query strings', () => {
    expect(
      searchQuerySchema.parse({
        query: 'queen',
        scope: 'lyrics',
        limit: '10',
        offset: '20',
      }),
    ).toEqual({ query: 'queen', scope: 'lyrics', limit: 10, offset: 20 });
  });

  it.each([{ query: '   ' }, { query: 'queen', limit: 101 }])(
    'rejects the invalid query %j',
    (input) => {
      expect(() => searchQuerySchema.parse(input)).toThrow();
    },
  );

  it.each([{ trackId: null }, { trackId: 'track-1' }])(
    'extends the catalog summary with the Track link %j',
    ({ trackId }) => {
      const item = { ...recordingSummary(testMbid(1), 'Song'), trackId };

      expect(searchResultItemSchema.parse(item)).toEqual(item);
    },
  );
});
