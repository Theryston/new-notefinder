import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { cacheTags, LOCALES } from '@notefinder/contracts';
import { WebRevalidationService } from '../../integrations/web-revalidation/web-revalidation.service.js';
import { PersonalHomeQueueService } from '../home/home-personal-queue.service.js';
import { UsersService } from '../users/users.service.js';
import { FavoriteWritesService } from './favorite-writes.service.js';
import { FavoritesService } from './favorites.service.js';

const favorites = { add: vi.fn(), remove: vi.fn() };
const users = { getCurrentUser: vi.fn() };
const webRevalidation = { revalidate: vi.fn() };
const personalRefresh = { scheduleRefresh: vi.fn() };

describe('FavoriteWritesService', () => {
  let service: FavoriteWritesService;
  const warn = vi.spyOn(Logger.prototype, 'warn');

  beforeEach(async () => {
    vi.resetAllMocks();
    warn.mockImplementation(() => undefined);
    const moduleRef = await Test.createTestingModule({
      providers: [
        FavoriteWritesService,
        { provide: FavoritesService, useValue: favorites },
        { provide: UsersService, useValue: users },
        { provide: WebRevalidationService, useValue: webRevalidation },
        { provide: PersonalHomeQueueService, useValue: personalRefresh },
      ],
    }).compile();
    service = moduleRef.get(FavoriteWritesService);
    users.getCurrentUser.mockResolvedValue({ username: 'ada_lovelace' });
    webRevalidation.revalidate.mockResolvedValue(undefined);
  });

  it('revalidates the favorites tag of the Profile when a favorite is added', async () => {
    await service.add('user-1', 'track-1');

    expect(favorites.add).toHaveBeenCalledWith('user-1', 'track-1');
    expect(webRevalidation.revalidate).toHaveBeenCalledWith([
      cacheTags.userFavorites('ada_lovelace'),
    ]);
  });

  // A favorite changes the User's taste, so the personal snapshot is rebuilt
  // after the debounce delay, in every locale the User may read.
  it('schedules a debounced personal snapshot rebuild when a favorite is added', async () => {
    await service.add('user-1', 'track-1');

    expect(personalRefresh.scheduleRefresh).toHaveBeenCalledTimes(
      LOCALES.length,
    );
    for (const locale of LOCALES) {
      expect(personalRefresh.scheduleRefresh).toHaveBeenCalledWith(
        'user-1',
        locale,
      );
    }
  });

  it('revalidates the favorites tag of the Profile when a favorite is removed', async () => {
    await service.remove('user-1', 'track-1');

    expect(favorites.remove).toHaveBeenCalledWith('user-1', 'track-1');
    expect(webRevalidation.revalidate).toHaveBeenCalledWith([
      cacheTags.userFavorites('ada_lovelace'),
    ]);
  });

  it('revalidates nothing for a User without a username, which has no Profile', async () => {
    users.getCurrentUser.mockResolvedValue({ username: null });

    await service.add('user-1', 'track-1');

    expect(favorites.add).toHaveBeenCalledWith('user-1', 'track-1');
    expect(webRevalidation.revalidate).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it('keeps the saved favorite when the revalidation cannot be queued, and logs why', async () => {
    webRevalidation.revalidate.mockRejectedValue(new Error('redis is down'));

    await expect(service.add('user-1', 'track-1')).resolves.toBeUndefined();
    expect(favorites.add).toHaveBeenCalledWith('user-1', 'track-1');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('redis is down'));
  });
});
