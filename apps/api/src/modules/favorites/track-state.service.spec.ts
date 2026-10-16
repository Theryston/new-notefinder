import { Test } from '@nestjs/testing';
import { AttemptsService } from '../attempts/attempts.service.js';
import { FavoritesService } from './favorites.service.js';
import { TrackStateService } from './track-state.service.js';

const favorites = { getTrackState: vi.fn() };
const attempts = { bestScores: vi.fn() };

describe('TrackStateService', () => {
  let service: TrackStateService;

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        TrackStateService,
        { provide: FavoritesService, useValue: favorites },
        { provide: AttemptsService, useValue: attempts },
      ],
    }).compile();
    service = moduleRef.get(TrackStateService);
  });

  it('reads the favorite with the best saved score per difficulty', async () => {
    favorites.getTrackState.mockResolvedValue({ isFavorite: true });
    attempts.bestScores.mockResolvedValue({
      EASY: 0.9,
      NORMAL: null,
      HARD: null,
    });

    await expect(service.getState('user-1', 'track-1')).resolves.toEqual({
      isFavorite: true,
      bestScores: { EASY: 0.9, NORMAL: null, HARD: null },
    });
    expect(favorites.getTrackState).toHaveBeenCalledWith('user-1', 'track-1');
    expect(attempts.bestScores).toHaveBeenCalledWith('user-1', 'track-1');
  });

  it('passes through a missing or moved Track', async () => {
    const moved = new Error('Track moved');
    favorites.getTrackState.mockRejectedValue(moved);

    await expect(service.getState('user-1', 'old')).rejects.toBe(moved);
    expect(attempts.bestScores).not.toHaveBeenCalled();
  });
});
