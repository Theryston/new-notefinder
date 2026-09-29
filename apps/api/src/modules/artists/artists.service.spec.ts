import { Test } from '@nestjs/testing';
import { artistSchema } from '@notefinder/contracts';
import { AppException } from '../../common/errors/app-exception.js';
import { TracksService } from '../tracks/tracks.service.js';
import { ArtistsRepository } from './artists.repository.js';
import { ArtistsService } from './artists.service.js';

describe('ArtistsService', () => {
  let service: ArtistsService;
  const repository = { findById: vi.fn() };
  const tracksService = { listCompleted: vi.fn(), countCompleted: vi.fn() };

  beforeEach(async () => {
    vi.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ArtistsService,
        { provide: ArtistsRepository, useValue: repository },
        { provide: TracksService, useValue: tracksService },
      ],
    }).compile();
    service = moduleRef.get(ArtistsService);
  });

  describe('getArtist', () => {
    it('returns the artist with its completed track count', async () => {
      repository.findById.mockResolvedValue({ id: 'x1', name: 'Name' });
      tracksService.countCompleted.mockResolvedValue(3);

      const result = await service.getArtist('x1');

      expect(result).toEqual({ id: 'x1', name: 'Name', trackCount: 3 });
      expect(artistSchema.parse(result)).toEqual(result);
      expect(repository.findById).toHaveBeenCalledWith('x1');
      expect(tracksService.countCompleted).toHaveBeenCalledWith({
        artistId: 'x1',
      });
    });

    it('rejects with NOT_FOUND for an unknown ID', async () => {
      repository.findById.mockResolvedValue(undefined);
      tracksService.countCompleted.mockResolvedValue(0);

      await expect(service.getArtist('nope')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });
  });

  describe('listTracks', () => {
    it('lists the completed tracks of the artist', async () => {
      const page = { items: [], nextCursor: null };
      repository.findById.mockResolvedValue({ id: 'x1', name: 'Name' });
      tracksService.listCompleted.mockResolvedValue(page);

      await expect(
        service.listTracks('x1', { limit: 24, cursor: 'c' }),
      ).resolves.toBe(page);
      expect(tracksService.listCompleted).toHaveBeenCalledWith(
        { artistId: 'x1' },
        { limit: 24, cursor: 'c' },
      );
    });

    it('rejects with NOT_FOUND before listing an unknown ID', async () => {
      repository.findById.mockResolvedValue(undefined);

      const error = await service
        .listTracks('nope', { limit: 24 })
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(AppException);
      expect(error).toMatchObject({ code: 'NOT_FOUND' });
      expect(tracksService.listCompleted).not.toHaveBeenCalled();
    });
  });
});
