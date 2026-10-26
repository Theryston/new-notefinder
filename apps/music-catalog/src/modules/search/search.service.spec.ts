import { CatalogError } from '../../errors/catalog-error.js';
import type { MeilisearchIndex } from '../../integrations/meilisearch/meilisearch-index.js';
import type { RecordingDocument } from '../../lib/recordings-index.js';
import type { BootstrapService } from '../bootstrap/bootstrap.service.js';
import { SearchService } from './search.service.js';

const document = (mbid: string): RecordingDocument => ({
  mbid,
  title: `Title of ${mbid}`,
  artistCredit: 'Artist',
  primaryReleaseMbid: null,
  artistAliases: [],
  releaseTitles: [],
  workTitles: [],
  genres: [],
  disambiguation: '',
});

const params = {
  query: 'hello',
  limit: 10,
  offset: 20,
} as const;

const setup = (
  options: { hits?: ReturnType<typeof document>[]; notReady?: boolean } = {},
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
  const service = new SearchService({
    bootstrap: bootstrap as unknown as BootstrapService,
    index: index as unknown as MeilisearchIndex<RecordingDocument>,
  });
  return { service, bootstrap, index, callOrder };
};

describe('SearchService', () => {
  it('searches the bounded display fields directly in the index', async () => {
    const { service, index, callOrder } = setup({
      hits: [document('a'), document('b')],
    });

    await service.search(params);

    expect(index.search).toHaveBeenCalledExactlyOnceWith(
      'hello',
      {
        limit: 10,
        offset: 20,
      },
      ['mbid', 'title', 'artistCredit', 'primaryReleaseMbid'],
    );
    expect(callOrder).toEqual(['assertReady', 'index']);
  });

  it('does not hydrate indexed hits from the summary repository', async () => {
    const { bootstrap, index } = setup({ hits: [document('a')] });
    const findByMbids = vi.fn(() => {
      throw new Error('search must not hydrate summaries from Postgres');
    });
    const service = new SearchService({
      bootstrap: bootstrap as unknown as BootstrapService,
      index: index as unknown as MeilisearchIndex<RecordingDocument>,
      summaries: { findByMbids },
    } as unknown as ConstructorParameters<typeof SearchService>[0]);

    await expect(service.search(params)).resolves.toMatchObject({
      results: [{ mbid: 'a' }],
    });
    expect(bootstrap.assertReady).toHaveBeenCalledOnce();
    expect(findByMbids).not.toHaveBeenCalled();
  });

  it('returns compact items in the order the index ranked them', async () => {
    const { service } = setup({
      hits: [document('c'), document('a'), document('b')],
    });

    const { results } = await service.search(params);

    expect(results.map((r) => r.mbid)).toEqual(['c', 'a', 'b']);
  });

  it('derives the cover URL from the indexed primary-release MBID', async () => {
    const indexed = {
      ...document('a'),
      primaryReleaseMbid: '00000000-0000-4000-8000-000000000050',
    };
    const { service } = setup({ hits: [indexed] });

    await expect(service.search(params)).resolves.toMatchObject({
      results: [
        {
          mbid: 'a',
          title: 'Title of a',
          artistCredit: 'Artist',
          coverUrl:
            'https://coverartarchive.org/release/00000000-0000-4000-8000-000000000050/front-500',
          trackId: null,
        },
      ],
    });
  });

  it('treats a pre-upgrade index document without a release MBID as a null cover', async () => {
    const legacyDocument: RecordingDocument = { ...document('a') };
    delete legacyDocument.primaryReleaseMbid;
    const { service } = setup({ hits: [legacyDocument] });

    await expect(service.search(params)).resolves.toMatchObject({
      results: [{ mbid: 'a', coverUrl: null, trackId: null }],
    });
  });

  it('returns no results when the index finds nothing', async () => {
    const { service } = setup();

    await expect(service.search(params)).resolves.toEqual({ results: [] });
  });

  it('refuses the search, reaching neither the index nor the database, before the catalog is ready', async () => {
    const { service, index } = setup({ notReady: true });

    await expect(service.search(params)).rejects.toMatchObject({
      code: 'CATALOG_NOT_READY',
    });
    expect(index.search).not.toHaveBeenCalled();
  });
});
