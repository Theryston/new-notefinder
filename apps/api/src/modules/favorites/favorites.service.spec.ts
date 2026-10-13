import { Test } from '@nestjs/testing';
import { AppException } from '../../common/errors/app-exception.js';
import { TracksService } from '../tracks/tracks.service.js';
import { FavoritesRepository } from './favorites.repository.js';
import { FavoritesService } from './favorites.service.js';

const repository = {
  add: vi.fn(),
  remove: vi.fn(),
  isFavorite: vi.fn(),
};
const tracks = { assertTrackExists: vi.fn() };

describe('FavoritesService', () => {
  let service: FavoritesService;

  beforeEach(async () => {
    vi.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        FavoritesService,
        { provide: FavoritesRepository, useValue: repository },
        { provide: TracksService, useValue: tracks },
      ],
    }).compile();
    service = moduleRef.get(FavoritesService);
  });

  it('adds and removes the favorite of a Track that exists', async () => {
    tracks.assertTrackExists.mockResolvedValue(undefined);

    await service.add('user-1', 'track-1');
    await service.remove('user-1', 'track-1');

    expect(repository.add).toHaveBeenCalledWith('user-1', 'track-1');
    expect(repository.remove).toHaveBeenCalledWith('user-1', 'track-1');
  });

  it('reads the state of a Track that exists', async () => {
    tracks.assertTrackExists.mockResolvedValue(undefined);
    repository.isFavorite.mockResolvedValue(true);

    await expect(service.getTrackState('user-1', 'track-1')).resolves.toEqual({
      isFavorite: true,
    });
    expect(repository.isFavorite).toHaveBeenCalledWith('user-1', 'track-1');
  });

  it('writes and reads nothing for a Track that is missing or moved', async () => {
    const moved = new AppException('RESOURCE_MOVED', 'Track moved', {
      id: 'new',
    });
    tracks.assertTrackExists.mockRejectedValue(moved);

    await expect(service.add('user-1', 'old')).rejects.toBe(moved);
    await expect(service.remove('user-1', 'old')).rejects.toBe(moved);
    await expect(service.getTrackState('user-1', 'old')).rejects.toBe(moved);

    expect(repository.add).not.toHaveBeenCalled();
    expect(repository.remove).not.toHaveBeenCalled();
    expect(repository.isFavorite).not.toHaveBeenCalled();
  });
});
