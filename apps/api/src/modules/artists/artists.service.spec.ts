import { Test } from '@nestjs/testing';
import { artistSchema } from '@notefinder/contracts';
import { AppException } from '../../common/errors/app-exception.js';
import { ArtistsRepository } from './artists.repository.js';
import { ArtistsService } from './artists.service.js';

const artist = {
  id: 'artist-1',
  mbid: '00000000-0000-4000-8000-000000001001',
  name: 'Queen',
  genres: ['rock'],
  trackCount: 2,
};

describe('ArtistsService', () => {
  let service: ArtistsService;
  const repository = {
    findArtistById: vi.fn(),
    findArtistIdByLegacyId: vi.fn(),
  };

  beforeEach(async () => {
    repository.findArtistById.mockReset();
    repository.findArtistIdByLegacyId.mockReset();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ArtistsService,
        { provide: ArtistsRepository, useValue: repository },
      ],
    }).compile();
    service = moduleRef.get(ArtistsService);
  });

  it('returns the artist header detail', async () => {
    repository.findArtistById.mockResolvedValue(artist);

    const result = await service.getArtist('artist-1');

    expect(repository.findArtistById).toHaveBeenCalledWith('artist-1');
    expect(result).toEqual(artist);
    expect(artistSchema.parse(result)).toEqual(result);
  });

  it('answers RESOURCE_MOVED with the new ID for a legacy ID', async () => {
    repository.findArtistById.mockResolvedValue(undefined);
    repository.findArtistIdByLegacyId.mockResolvedValue('artist-1');

    const failure = await service.getArtist('legacy-1').then(
      () => undefined,
      (error: unknown) => error,
    );

    expect(repository.findArtistIdByLegacyId).toHaveBeenCalledWith('legacy-1');
    expect(failure).toBeInstanceOf(AppException);
    const exception = failure as AppException;
    expect(exception.code).toBe('RESOURCE_MOVED');
    expect(exception.getStatus()).toBe(404);
    expect(exception.toApiError()).toMatchObject({
      statusCode: 404,
      code: 'RESOURCE_MOVED',
      details: { id: 'artist-1' },
    });
  });

  it('answers NOT_FOUND for an unknown ID', async () => {
    repository.findArtistById.mockResolvedValue(undefined);
    repository.findArtistIdByLegacyId.mockResolvedValue(undefined);

    const failure = await service.getArtist('missing').then(
      () => undefined,
      (error: unknown) => error,
    );

    expect(failure).toBeInstanceOf(AppException);
    expect((failure as AppException).code).toBe('NOT_FOUND');
  });
});
