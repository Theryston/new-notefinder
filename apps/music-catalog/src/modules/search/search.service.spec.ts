import { CatalogError } from '../../errors/catalog-error.js';
import type { MeilisearchIndex } from '../../integrations/meilisearch/meilisearch-index.js';
import type { RecordingDocument } from '../../lib/recordings-index.js';
import type { BootstrapService } from '../bootstrap/bootstrap.service.js';
import type { RecordingSummaryService } from '../recording/recording-summary.service.js';
import { SearchService } from './search.service.js';

const summary = (mbid: string) => ({
  mbid,
  title: `Title of ${mbid}`,
  lengthMs: null,
  disambiguation: '',
  video: false,
  artistCredit: { name: 'Artist', artists: [] },
  primaryRelease: null,
  genres: [],
});

const params = {
  query: 'hello',
  scope: 'metadata',
  limit: 10,
  offset: 20,
} as const;

const setup = (
  options: {
    hits?: string[];
    summaries?: ReturnType<typeof summary>[];
    notReady?: boolean;
  } = {},
) => {
  const callOrder: string[] = [];
  const bootstrap = {
    assertReady: vi.fn(async () => {
      callOrder.push('assertReady');
      if (options.notReady) {
        throw new CatalogError('CATALOG_NOT_READY', 'still importing');
      }
    }),
  };
  const index = {
    search: vi.fn(async () => {
      callOrder.push('index');
      return options.hits ?? [];
    }),
  };
  const summaries = {
    findByMbids: vi.fn(async () => {
      callOrder.push('summaries');
      return options.summaries ?? [];
    }),
  };
  const service = new SearchService({
    bootstrap: bootstrap as unknown as BootstrapService,
    index: index as unknown as MeilisearchIndex<RecordingDocument>,
    summaries: summaries as unknown as RecordingSummaryService,
  });
  return { service, index, summaries, callOrder };
};

describe('SearchService', () => {
  describe('search in the metadata scope', () => {
    it('asks the index for the page of the query, then reads the summaries of what it found', async () => {
      const { service, index, summaries, callOrder } = setup({
        hits: ['a', 'b'],
        summaries: [summary('a'), summary('b')],
      });

      await service.search(params);

      expect(index.search).toHaveBeenCalledExactlyOnceWith('hello', {
        limit: 10,
        offset: 20,
      });
      expect(summaries.findByMbids).toHaveBeenCalledExactlyOnceWith(['a', 'b']);
      expect(callOrder).toEqual(['assertReady', 'index', 'summaries']);
    });

    it('returns the summaries in the order the index ranked them, not the order they were read in', async () => {
      const { service } = setup({
        hits: ['c', 'a', 'b'],
        summaries: [summary('a'), summary('b'), summary('c')],
      });

      const { results } = await service.search(params);

      expect(results.map((r) => r.mbid)).toEqual(['c', 'a', 'b']);
    });

    it('drops the hits that are no longer in the database', async () => {
      const { service } = setup({
        hits: ['a', 'gone', 'b'],
        summaries: [summary('b'), summary('a')],
      });

      const { results } = await service.search(params);

      expect(results.map((r) => r.mbid)).toEqual(['a', 'b']);
    });

    it('returns no results when the index finds nothing', async () => {
      const { service } = setup();

      await expect(service.search(params)).resolves.toEqual({ results: [] });
    });
  });

  it('refuses the search, reaching neither the index nor the database, before the catalog is ready', async () => {
    const { service, index, summaries } = setup({ notReady: true });

    await expect(service.search(params)).rejects.toMatchObject({
      code: 'CATALOG_NOT_READY',
    });
    expect(index.search).not.toHaveBeenCalled();
    expect(summaries.findByMbids).not.toHaveBeenCalled();
  });

  describe('search in the lyrics scope', () => {
    it('answers no results, without asking the metadata index, until Lyrics are imported', async () => {
      const { service, index, summaries } = setup({ hits: ['a'] });

      const result = await service.search({ ...params, scope: 'lyrics' });

      expect(result).toEqual({ results: [] });
      expect(index.search).not.toHaveBeenCalled();
      expect(summaries.findByMbids).not.toHaveBeenCalled();
    });

    it('still waits for the catalog to be ready', async () => {
      const { service } = setup({ notReady: true });

      await expect(
        service.search({ ...params, scope: 'lyrics' }),
      ).rejects.toMatchObject({ code: 'CATALOG_NOT_READY' });
    });
  });
});
