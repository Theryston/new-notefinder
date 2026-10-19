import { Test } from '@nestjs/testing';
import { AppException } from '../../common/errors/app-exception.js';
import { TracksService } from '../tracks/tracks.service.js';
import { UserProfileService } from '../users/user-profile.service.js';
import {
  encodeFavoriteCursor,
  type FavoriteCursor,
} from './favorite-cursor.js';
import { FavoritesRepository } from './favorites.repository.js';
import { UserFavoritesService } from './user-favorites.service.js';

const repository = { findPageByUsername: vi.fn() };
const tracks = { getCatalogTracks: vi.fn() };
const profiles = { getPublicProfile: vi.fn() };

const row = (id: string, trackId: string, favoritedAt: string) => ({
  id,
  trackId,
  favoritedAt: new Date(favoritedAt),
});

describe('UserFavoritesService', () => {
  let service: UserFavoritesService;

  beforeEach(async () => {
    vi.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        UserFavoritesService,
        { provide: FavoritesRepository, useValue: repository },
        { provide: TracksService, useValue: tracks },
        { provide: UserProfileService, useValue: profiles },
      ],
    }).compile();
    service = moduleRef.get(UserFavoritesService);
    profiles.getPublicProfile.mockResolvedValue({});
    tracks.getCatalogTracks.mockImplementation((ids: string[]) =>
      ids.map((id) => ({ id })),
    );
  });

  it('lists the Tracks of the lowercased username, newest first', async () => {
    repository.findPageByUsername.mockResolvedValue([
      row('fav-2', 'track-b', '2026-01-02T00:00:00.000Z'),
      row('fav-1', 'track-a', '2026-01-01T00:00:00.000Z'),
    ]);

    const page = await service.listPage('Ada_Lovelace', { limit: 20 });

    expect(profiles.getPublicProfile).toHaveBeenCalledWith('ada_lovelace');
    expect(repository.findPageByUsername).toHaveBeenCalledWith('ada_lovelace', {
      after: undefined,
      limit: 20,
    });
    expect(tracks.getCatalogTracks).toHaveBeenCalledWith([
      'track-b',
      'track-a',
    ]);
    expect(page).toEqual({
      items: [{ id: 'track-b' }, { id: 'track-a' }],
      nextCursor: null,
    });
  });

  it('ends the listing when exactly one page of favorites is left', async () => {
    repository.findPageByUsername.mockResolvedValue([
      row('fav-2', 'track-b', '2026-01-02T00:00:00.000Z'),
      row('fav-1', 'track-a', '2026-01-01T00:00:00.000Z'),
    ]);

    const page = await service.listPage('ada', { limit: 2 });

    expect(page.nextCursor).toBeNull();
  });

  it('keeps the cursor on the last shown favorite of a full page', async () => {
    repository.findPageByUsername.mockResolvedValue([
      row('fav-4', 'track-d', '2026-01-04T00:00:00.000Z'),
      row('fav-3', 'track-c', '2026-01-03T00:00:00.000Z'),
      row('fav-2', 'track-b', '2026-01-02T00:00:00.000Z'),
      row('fav-1', 'track-a', '2026-01-01T00:00:00.000Z'),
    ]);

    const page = await service.listPage('ada', { limit: 3 });

    expect(tracks.getCatalogTracks).toHaveBeenCalledWith([
      'track-d',
      'track-c',
      'track-b',
    ]);
    expect(page.nextCursor).toBe(
      encodeFavoriteCursor({
        favoritedAt: '2026-01-02T00:00:00.000Z',
        favoriteId: 'fav-2',
      }),
    );
  });

  it('answers the rows past the limit with a cursor after the last shown one', async () => {
    repository.findPageByUsername.mockResolvedValue([
      row('fav-3', 'track-c', '2026-01-03T00:00:00.123Z'),
      row('fav-2', 'track-b', '2026-01-02T00:00:00.000Z'),
      row('fav-1', 'track-a', '2026-01-01T00:00:00.000Z'),
    ]);

    const page = await service.listPage('ada', { limit: 2 });

    expect(tracks.getCatalogTracks).toHaveBeenCalledWith([
      'track-c',
      'track-b',
    ]);
    expect(page.nextCursor).toBe(
      encodeFavoriteCursor({
        favoritedAt: '2026-01-02T00:00:00.000Z',
        favoriteId: 'fav-2',
      }),
    );
  });

  it('resumes after the cursor position, in milliseconds and by ID', async () => {
    const position: FavoriteCursor = {
      favoritedAt: '2026-01-02T00:00:00.000Z',
      favoriteId: 'fav-2',
    };
    repository.findPageByUsername.mockResolvedValue([]);

    await service.listPage('ada', {
      cursor: encodeFavoriteCursor(position),
      limit: 20,
    });

    expect(repository.findPageByUsername).toHaveBeenCalledWith('ada', {
      after: {
        favoritedAt: new Date('2026-01-02T00:00:00.000Z'),
        id: 'fav-2',
      },
      limit: 20,
    });
  });

  it('answers an empty page for a User with no favorites', async () => {
    repository.findPageByUsername.mockResolvedValue([]);

    await expect(service.listPage('ada', { limit: 20 })).resolves.toEqual({
      items: [],
      nextCursor: null,
    });
    expect(tracks.getCatalogTracks).toHaveBeenCalledWith([]);
  });

  it('answers NOT_FOUND for an unknown username and reads no favorites', async () => {
    const missing = new AppException('NOT_FOUND', 'User not found');
    profiles.getPublicProfile.mockRejectedValue(missing);

    await expect(service.listPage('nobody', { limit: 20 })).rejects.toBe(
      missing,
    );
    expect(repository.findPageByUsername).not.toHaveBeenCalled();
  });

  it('refuses a tampered cursor before reading any favorites', async () => {
    await expect(
      service.listPage('ada', { cursor: 'fav-2', limit: 20 }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(repository.findPageByUsername).not.toHaveBeenCalled();
  });
});
