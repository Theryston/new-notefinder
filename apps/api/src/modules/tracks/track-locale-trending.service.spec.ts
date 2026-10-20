import { Test } from '@nestjs/testing';
import { TrackLocaleTrendingService } from './track-locale-trending.service.js';
import { TrackViewRepository } from './track-view.repository.js';

describe('TrackLocaleTrendingService', () => {
  let service: TrackLocaleTrendingService;
  const views = { localeViewCounts: vi.fn() };

  beforeEach(async () => {
    vi.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        TrackLocaleTrendingService,
        { provide: TrackViewRepository, useValue: views },
      ],
    }).compile();
    service = moduleRef.get(TrackLocaleTrendingService);
  });

  it('reads the locale views since the start of the windows that end now', async () => {
    views.localeViewCounts.mockResolvedValue([]);

    await service.rank('pt-BR', new Date('2026-10-20T10:30:00Z'));

    expect(views.localeViewCounts).toHaveBeenCalledWith(
      'pt-BR',
      expect.objectContaining({
        hour: new Date('2026-10-20T10:00:00Z'),
        day: new Date('2026-10-20T00:00:00Z'),
        month: new Date('2026-10-01T00:00:00Z'),
      }),
    );
  });

  it('answers the locale ranking when it has enough views', async () => {
    views.localeViewCounts.mockResolvedValue([
      { trackId: 'a', hour: 1, day: 1, week: 1, month: 100, allTime: 100 },
    ]);

    await expect(service.rank('en')).resolves.toEqual([
      { trackId: 'a', score: expect.any(Number) },
    ]);
  });

  it('answers nothing when the locale has no view this month', async () => {
    views.localeViewCounts.mockResolvedValue([
      { trackId: 'a', hour: 0, day: 0, week: 0, month: 0, allTime: 3 },
    ]);

    await expect(service.rank('en')).resolves.toBeUndefined();
  });
});
