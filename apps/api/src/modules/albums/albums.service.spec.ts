import { Test } from '@nestjs/testing';
import { albumSchema } from '@notefinder/contracts';
import { TracksService } from '../tracks/tracks.service.js';
import { AlbumsRepository } from './albums.repository.js';
import { AlbumsService } from './albums.service.js';

describe('AlbumsService', () => {
  const findById = vi.fn();
  const listCompleted = vi.fn();
  const countCompleted = vi.fn();
  let service: AlbumsService;

  beforeEach(async () => {
    vi.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AlbumsService,
        { provide: AlbumsRepository, useValue: { findById } },
        {
          provide: TracksService,
          useValue: { listCompleted, countCompleted },
        },
      ],
    }).compile();
    service = moduleRef.get(AlbumsService);
  });

  it('returns the album with the count of its completed tracks', async () => {
    findById.mockResolvedValue({ id: 'al1', name: 'Acústico' });
    countCompleted.mockResolvedValue(12);

    const album = await service.getAlbum('al1');

    expect(album).toEqual({ id: 'al1', name: 'Acústico', trackCount: 12 });
    expect(albumSchema.parse(album)).toEqual(album);
    expect(countCompleted).toHaveBeenCalledWith({ albumId: 'al1' });
  });

  it('lists the completed tracks of the album with the query as given', async () => {
    const page = { items: [], nextCursor: 'next' };
    findById.mockResolvedValue({ id: 'al1', name: 'Acústico' });
    listCompleted.mockResolvedValue(page);

    await expect(service.listTracks('al1', { limit: 5 })).resolves.toBe(page);
    expect(listCompleted).toHaveBeenCalledWith(
      { albumId: 'al1' },
      { limit: 5 },
    );
  });

  it.each([
    ['getAlbum', () => service.getAlbum('nope')],
    ['listTracks', () => service.listTracks('nope', { limit: 5 })],
  ])('%s rejects an unknown ID with NOT_FOUND', async (_, call) => {
    findById.mockResolvedValue(undefined);
    countCompleted.mockResolvedValue(0);

    await expect(call()).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Album not found',
    });
    expect(listCompleted).not.toHaveBeenCalled();
  });
});
