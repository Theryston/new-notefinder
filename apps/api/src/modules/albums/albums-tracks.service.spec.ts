import { Test } from '@nestjs/testing';
import { albumTracksPageSchema } from '@notefinder/contracts';
import { AppException } from '../../common/errors/app-exception.js';
import { encodeAlbumTrackCursor } from './album-track-cursor.js';
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
  trackCount: 1,
  artists: [{ id: 'artist-1', name: 'Queen' }],
};

const track = {
  id: 'track-1',
  title: 'Bohemian Rhapsody',
  lengthMs: 354_000,
  disambiguation: '',
  video: false,
  isrcs: ['GBUM71029604'],
  artists: [{ id: 'artist-1', name: 'Queen' }],
  genres: ['rock'],
  releases: [],
  works: [],
  tags: [],
  externalLinks: [],
  disc: { position: 1, title: null },
};

const caught = async (promise: Promise<unknown>): Promise<unknown> =>
  promise.then(
    () => undefined,
    (error: unknown) => error,
  );

describe('AlbumsService tracks', () => {
  let service: AlbumsService;
  const repository = {
    findAlbumById: vi.fn(),
    findAlbumIdByLegacyId: vi.fn(),
    findTracksByAlbumId: vi.fn(),
  };

  beforeEach(async () => {
    repository.findAlbumById.mockReset();
    repository.findAlbumIdByLegacyId.mockReset();
    repository.findTracksByAlbumId.mockReset();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AlbumsService,
        { provide: AlbumsRepository, useValue: repository },
      ],
    }).compile();
    service = moduleRef.get(AlbumsService);
  });

  it('returns the contracted page for a known album', async () => {
    repository.findAlbumById.mockResolvedValue(album);
    repository.findTracksByAlbumId.mockResolvedValue({
      items: [track],
      nextCursor: null,
    });

    const result = await service.getAlbumTracks('album-1', { limit: 20 });

    expect(repository.findTracksByAlbumId).toHaveBeenCalledWith('album-1', {
      cursor: undefined,
      limit: 20,
    });
    expect(result).toEqual({ items: [track], nextCursor: null });
    expect(albumTracksPageSchema.parse(result)).toEqual(result);
  });

  it('decodes the cursor before listing and encodes the next one', async () => {
    const next = { discPosition: 2, trackPosition: 3, trackId: 'track-7' };
    repository.findAlbumById.mockResolvedValue(album);
    repository.findTracksByAlbumId.mockResolvedValue({
      items: [track],
      nextCursor: next,
    });
    const cursor = encodeAlbumTrackCursor({
      discPosition: 1,
      trackPosition: 2,
      trackId: 'track-4',
    });

    const result = await service.getAlbumTracks('album-1', {
      cursor,
      limit: 1,
    });

    expect(repository.findTracksByAlbumId).toHaveBeenCalledWith('album-1', {
      cursor: { discPosition: 1, trackPosition: 2, trackId: 'track-4' },
      limit: 1,
    });
    expect(result.nextCursor).toBe(encodeAlbumTrackCursor(next));
  });

  it('answers RESOURCE_MOVED with the new ID for a legacy ID', async () => {
    repository.findAlbumById.mockResolvedValue(undefined);
    repository.findAlbumIdByLegacyId.mockResolvedValue('album-1');

    const failure = await caught(
      service.getAlbumTracks('legacy-1', { limit: 20 }),
    );

    expect(failure).toBeInstanceOf(AppException);
    expect(failure).toMatchObject({
      code: 'RESOURCE_MOVED',
      details: { id: 'album-1' },
    });
    expect(repository.findTracksByAlbumId).not.toHaveBeenCalled();
  });

  it('answers a real NOT_FOUND for an ID that is neither an album nor legacy', async () => {
    repository.findAlbumById.mockResolvedValue(undefined);
    repository.findAlbumIdByLegacyId.mockResolvedValue(undefined);

    const failure = await caught(
      service.getAlbumTracks('unknown', { limit: 20 }),
    );

    expect(failure).toMatchObject({ code: 'NOT_FOUND' });
    expect(repository.findTracksByAlbumId).not.toHaveBeenCalled();
  });

  it('rejects an invalid cursor with a validation error', async () => {
    repository.findAlbumById.mockResolvedValue(album);

    const failure = await caught(
      service.getAlbumTracks('album-1', { cursor: 'track-1', limit: 20 }),
    );

    expect(failure).toBeInstanceOf(AppException);
    expect(failure).toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(repository.findTracksByAlbumId).not.toHaveBeenCalled();
  });
});
