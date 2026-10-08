import { Test } from '@nestjs/testing';
import { albumSchema } from '@notefinder/contracts';
import { AppException } from '../../common/errors/app-exception.js';
import { AlbumsRepository } from './albums.repository.js';
import { AlbumsService } from './albums.service.js';

const album = {
  id: 'album-1',
  mbid: '00000000-0000-4000-8000-00000000a001',
  title: 'A Night at the Opera',
  primaryType: 'Album',
  secondaryTypes: [],
  year: 1975,
  genres: ['rock'],
  coverArtUrl: null,
  trackCount: 0,
  artists: [{ id: 'artist-1', name: 'Queen' }],
};

const caught = async (promise: Promise<unknown>): Promise<unknown> =>
  promise.then(
    () => undefined,
    (error: unknown) => error,
  );

describe('AlbumsService', () => {
  let service: AlbumsService;
  const repository = {
    findAlbumById: vi.fn(),
    findAlbumIdByLegacyId: vi.fn(),
  };

  beforeEach(async () => {
    repository.findAlbumById.mockReset();
    repository.findAlbumIdByLegacyId.mockReset();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AlbumsService,
        { provide: AlbumsRepository, useValue: repository },
      ],
    }).compile();
    service = moduleRef.get(AlbumsService);
  });

  it('returns the album detail with its credited artists', async () => {
    repository.findAlbumById.mockResolvedValue(album);

    const result = await service.getAlbum('album-1');

    expect(repository.findAlbumById).toHaveBeenCalledWith('album-1');
    expect(result).toEqual(album);
    expect(albumSchema.parse(result)).toEqual(result);
  });

  it('answers RESOURCE_MOVED with the new ID for a legacy ID', async () => {
    repository.findAlbumById.mockResolvedValue(undefined);
    repository.findAlbumIdByLegacyId.mockResolvedValue('album-1');

    const failure = await caught(service.getAlbum('legacy-1'));

    expect(failure).toBeInstanceOf(AppException);
    expect(failure).toMatchObject({
      code: 'RESOURCE_MOVED',
      details: { id: 'album-1' },
    });
    expect(repository.findAlbumIdByLegacyId).toHaveBeenCalledWith('legacy-1');
  });

  it('answers a real NOT_FOUND for an ID that is neither an album nor legacy', async () => {
    repository.findAlbumById.mockResolvedValue(undefined);
    repository.findAlbumIdByLegacyId.mockResolvedValue(undefined);

    const failure = await caught(service.getAlbum('unknown'));

    expect(failure).toBeInstanceOf(AppException);
    expect(failure).toMatchObject({ code: 'NOT_FOUND' });
  });

  it('does not consult the legacy map when the ID is a current album', async () => {
    repository.findAlbumById.mockResolvedValue(album);

    await service.getAlbum('album-1');

    expect(repository.findAlbumIdByLegacyId).not.toHaveBeenCalled();
  });
});
