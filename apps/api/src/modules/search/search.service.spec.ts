import { Test } from '@nestjs/testing';
import { searchResultSchema } from '@notefinder/contracts';
import { testMbid } from '../../../test/utils/factories.js';
import { recordingSummary } from '../../../test/utils/recording-summaries.js';
import { MusicCatalogClient } from '../../integrations/music-catalog/music-catalog.client.js';
import { TracksService } from '../tracks/tracks.service.js';
import { SearchService } from './search.service.js';

describe('SearchService', () => {
  let service: SearchService;
  const catalog = {
    search: vi.fn(),
  };
  const tracks = {
    attachTrackIds: vi.fn(),
  };

  beforeEach(async () => {
    catalog.search.mockReset();
    tracks.attachTrackIds.mockReset();
    tracks.attachTrackIds.mockImplementation(async (results: unknown[]) =>
      results.map((result) => ({
        ...(result as Record<string, unknown>),
        trackId:
          (result as { mbid: string }).mbid === testMbid(1) ? 'track-1' : null,
      })),
    );
    const moduleRef = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: MusicCatalogClient, useValue: catalog },
        { provide: TracksService, useValue: tracks },
      ],
    }).compile();
    service = moduleRef.get(SearchService);
  });

  it('enriches the catalog hits in order with linked versus static', async () => {
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
      ['First', 'track-1'],
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
    expect(tracks.attachTrackIds).toHaveBeenCalledWith([]);
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
    expect(tracks.attachTrackIds).not.toHaveBeenCalled();
  });
});
