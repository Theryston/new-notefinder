import { Test } from '@nestjs/testing';
import { searchResultSchema } from '@notefinder/contracts';
import { testMbid } from '../../../test/utils/factories.js';
import { recordingSummary } from '../../../test/utils/recording-summaries.js';
import { MusicCatalogClient } from '../../integrations/music-catalog/music-catalog.client.js';
import { SearchService } from './search.service.js';

describe('SearchService', () => {
  let service: SearchService;
  const catalog = {
    search: vi.fn(),
  };

  beforeEach(async () => {
    catalog.search.mockReset();
    const moduleRef = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: MusicCatalogClient, useValue: catalog },
      ],
    }).compile();
    service = moduleRef.get(SearchService);
  });

  it('returns the catalog hits in order with a null Track link', async () => {
    catalog.search.mockResolvedValue({
      results: [
        recordingSummary(testMbid(1), 'First'),
        recordingSummary(testMbid(2), 'Second'),
      ],
    });

    const result = await service.search({
      query: 'song',
      scope: 'metadata',
      limit: 20,
      offset: 0,
    });

    expect(catalog.search).toHaveBeenCalledWith({
      query: 'song',
      scope: 'metadata',
      limit: 20,
      offset: 0,
    });
    expect(result.results.map((item) => [item.title, item.trackId])).toEqual([
      ['First', null],
      ['Second', null],
    ]);
    expect(searchResultSchema.parse(result)).toEqual(result);
  });

  it('returns no hits when the catalog finds nothing', async () => {
    catalog.search.mockResolvedValue({ results: [] });

    await expect(
      service.search({
        query: 'nothing matches this',
        scope: 'metadata',
        limit: 20,
        offset: 0,
      }),
    ).resolves.toEqual({ results: [] });
  });

  it('lets catalog failures bubble up', async () => {
    catalog.search.mockRejectedValue(new Error('catalog down'));

    await expect(
      service.search({
        query: 'song',
        scope: 'metadata',
        limit: 20,
        offset: 0,
      }),
    ).rejects.toThrow('catalog down');
  });
});
