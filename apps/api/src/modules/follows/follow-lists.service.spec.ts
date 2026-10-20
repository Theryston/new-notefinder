import { Test } from '@nestjs/testing';
import { AppException } from '../../common/errors/app-exception.js';
import { UsersService } from '../users/users.service.js';
import { encodeFollowListCursor } from './follow-list-cursor.js';
import { FollowListsRepository } from './follow-lists.repository.js';
import { FollowListsService } from './follow-lists.service.js';

const lists = {
  findPage: vi.fn(),
};
const users = {
  findIdByUsername: vi.fn(),
};

const row = (id: string, followedAt: string, followId = `follow-${id}`) => ({
  id,
  username: id,
  name: `Name ${id}`,
  image: null,
  followId,
  followedAt: new Date(followedAt),
});

describe('FollowListsService', () => {
  let service: FollowListsService;

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        FollowListsService,
        { provide: FollowListsRepository, useValue: lists },
        { provide: UsersService, useValue: users },
      ],
    }).compile();
    service = moduleRef.get(FollowListsService);
    users.findIdByUsername.mockResolvedValue('ada-id');
  });

  it('reads the list of the User behind the username, from its first page', async () => {
    lists.findPage.mockResolvedValue([
      row('grace', '2026-01-02T00:00:00.000Z'),
    ]);

    await service.listPage('followers', 'Ada', { limit: 20 });

    expect(users.findIdByUsername).toHaveBeenCalledWith('Ada');
    expect(lists.findPage).toHaveBeenCalledWith('followers', 'ada-id', {
      after: undefined,
      limit: 20,
    });
  });

  it('maps each row to the public summary, without the follow fields', async () => {
    lists.findPage.mockResolvedValue([
      row('grace', '2026-01-02T00:00:00.000Z'),
    ]);

    const page = await service.listPage('following', 'ada', { limit: 20 });

    expect(page.items).toEqual([
      { id: 'grace', username: 'grace', name: 'Name grace', image: null },
    ]);
    expect(page.nextCursor).toBeNull();
  });

  it('reads one row past the limit, ends the page there and returns a cursor', async () => {
    lists.findPage.mockResolvedValue([
      row('grace', '2026-01-03T00:00:00.000Z', 'f-2'),
      row('linus', '2026-01-02T00:00:00.000Z', 'f-1'),
      row('ken', '2026-01-01T00:00:00.000Z', 'f-0'),
    ]);

    const page = await service.listPage('friends', 'ada', { limit: 2 });

    expect(lists.findPage).toHaveBeenCalledWith('friends', 'ada-id', {
      after: undefined,
      limit: 2,
    });
    expect(page.items.map((item) => item.id)).toEqual(['grace', 'linus']);
    expect(page.nextCursor).toBe(
      encodeFollowListCursor({
        followedAt: '2026-01-02T00:00:00.000Z',
        followId: 'f-1',
      }),
    );
  });

  it('resumes after the position the cursor names', async () => {
    lists.findPage.mockResolvedValue([]);
    const cursor = encodeFollowListCursor({
      followedAt: '2026-01-02T00:00:00.000Z',
      followId: 'f-1',
    });

    const page = await service.listPage('followers', 'ada', {
      cursor,
      limit: 20,
    });

    expect(lists.findPage).toHaveBeenCalledWith('followers', 'ada-id', {
      after: { followedAt: new Date('2026-01-02T00:00:00.000Z'), id: 'f-1' },
      limit: 20,
    });
    expect(page).toEqual({ items: [], nextCursor: null });
  });

  it('refuses a cursor this API did not issue before reading anything', async () => {
    await expect(
      service.listPage('followers', 'ada', {
        cursor: 'not-a-cursor',
        limit: 20,
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });

    expect(lists.findPage).not.toHaveBeenCalled();
  });

  it('answers NOT_FOUND for an unknown username and reads no list', async () => {
    users.findIdByUsername.mockRejectedValue(
      new AppException('NOT_FOUND', 'User not found'),
    );

    await expect(
      service.listPage('followers', 'nobody', { limit: 20 }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    expect(lists.findPage).not.toHaveBeenCalled();
  });
});
