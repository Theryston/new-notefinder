import { Test } from '@nestjs/testing';
import { TrackSitemapRepository } from './track-sitemap.repository.js';
import { TrackSitemapService } from './track-sitemap.service.js';
import { encodeTrackSitemapCursor } from './track-sitemap-cursor.js';

const sitemap = { listCompleted: vi.fn() };

const row = (id: string, trendingScore: number) => ({
  id,
  trendingScore,
  updatedAt: new Date('2026-10-14T12:00:00.000Z'),
});

describe('TrackSitemapService', () => {
  let service: TrackSitemapService;

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        TrackSitemapService,
        { provide: TrackSitemapRepository, useValue: sitemap },
      ],
    }).compile();
    service = moduleRef.get(TrackSitemapService);
  });

  it('lists the page and a cursor when another page follows', async () => {
    sitemap.listCompleted.mockResolvedValue([
      row('a', 9),
      row('b', 5),
      row('c', 5),
    ]);

    const page = await service.list({ limit: 2 });

    expect(sitemap.listCompleted).toHaveBeenCalledWith({
      after: undefined,
      limit: 3,
    });
    expect(page).toEqual({
      items: [
        { id: 'a', updatedAt: '2026-10-14T12:00:00.000Z' },
        { id: 'b', updatedAt: '2026-10-14T12:00:00.000Z' },
      ],
      nextCursor: encodeTrackSitemapCursor({ score: 5, trackId: 'b' }),
    });
  });

  it('has no cursor on the last page', async () => {
    sitemap.listCompleted.mockResolvedValue([row('a', 9), row('b', 5)]);

    const page = await service.list({ limit: 2 });

    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).toBeNull();
  });

  it('resumes after the cursor it issued', async () => {
    sitemap.listCompleted.mockResolvedValue([]);

    await service.list({
      limit: 2,
      cursor: encodeTrackSitemapCursor({ score: 5, trackId: 'b' }),
    });

    expect(sitemap.listCompleted).toHaveBeenCalledWith({
      after: { score: 5, trackId: 'b' },
      limit: 3,
    });
  });

  it('refuses a cursor it did not issue', async () => {
    await expect(service.list({ limit: 2, cursor: 'b' })).rejects.toMatchObject(
      { code: 'VALIDATION_FAILED' },
    );
  });
});
