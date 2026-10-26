import { CatalogError } from '../../errors/catalog-error.js';
import type { MeilisearchIndex } from '../../integrations/meilisearch/meilisearch-index.js';
import type { RecordingDocument } from '../../lib/recordings-index.js';
import type { Logger } from '../../logger.js';
import type { RecordingSummaryService } from '../recording/recording-summary.service.js';
import { SearchService } from './search.service.js';
import { SearchReadiness } from './search-readiness.js';

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
  const readiness = {
    assertReady: vi.fn(() => {
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
    readiness: readiness as unknown as SearchReadiness,
    index: index as unknown as MeilisearchIndex<RecordingDocument>,
    summaries: summaries as unknown as RecordingSummaryService,
  });
  return { service, index, summaries, callOrder };
};

describe('SearchService', () => {
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

  it('propagates Meilisearch failures instead of returning an empty result', async () => {
    const { service, index } = setup();
    const failure = new Error('Meilisearch unavailable');
    index.search.mockRejectedValueOnce(failure);

    await expect(service.search(params)).rejects.toBe(failure);
  });

  it('refuses the search before reaching the index or summaries when the cached catalog is not ready', async () => {
    const { service, index, summaries } = setup({ notReady: true });

    await expect(service.search(params)).rejects.toMatchObject({
      code: 'CATALOG_NOT_READY',
    });
    expect(index.search).not.toHaveBeenCalled();
    expect(summaries.findByMbids).not.toHaveBeenCalled();
  });

  it('never reads readiness again on nonempty, empty, failing, or not-ready requests', async () => {
    const logger = { error: vi.fn(), info: vi.fn(), warn: vi.fn() };
    const readReadyPhase = vi.fn(async () => 'ready' as const);
    const readiness = new SearchReadiness({
      readPhase: readReadyPhase,
      refreshIntervalMs: 5000,
      logger: logger as unknown as Logger,
    });
    await readiness.start();
    readReadyPhase.mockClear();
    const index = {
      search: vi
        .fn()
        .mockResolvedValueOnce(['a'])
        .mockResolvedValueOnce([])
        .mockRejectedValueOnce(new Error('Meilisearch unavailable')),
    };
    const summaries = {
      findByMbids: vi.fn(async () => [summary('a')]),
    };
    const service = new SearchService({
      readiness,
      index: index as unknown as MeilisearchIndex<RecordingDocument>,
      summaries: summaries as unknown as RecordingSummaryService,
    });

    try {
      await expect(service.search(params)).resolves.toMatchObject({
        results: [{ mbid: 'a' }],
      });
      await expect(service.search(params)).resolves.toEqual({ results: [] });
      await expect(service.search(params)).rejects.toThrow(
        'Meilisearch unavailable',
      );
      expect(readReadyPhase).not.toHaveBeenCalled();

      const notReadyRead = vi.fn(async () => 'indexing' as const);
      const notReady = new SearchReadiness({
        readPhase: notReadyRead,
        refreshIntervalMs: 5000,
        logger: logger as unknown as Logger,
      });
      await notReady.start();
      notReadyRead.mockClear();
      const notReadyService = new SearchService({
        readiness: notReady,
        index: index as unknown as MeilisearchIndex<RecordingDocument>,
        summaries: summaries as unknown as RecordingSummaryService,
      });
      await expect(notReadyService.search(params)).rejects.toMatchObject({
        code: 'CATALOG_NOT_READY',
      });
      expect(notReadyRead).not.toHaveBeenCalled();
      await notReady.stop();
    } finally {
      await readiness.stop();
    }
  });
});
