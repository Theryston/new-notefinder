import { Test } from '@nestjs/testing';
import { WebRevalidationService } from '../../integrations/web-revalidation/web-revalidation.service.js';
import { UsersService } from '../users/users.service.js';
import { FollowWritesService } from './follow-writes.service.js';
import { FollowsService } from './follows.service.js';

const follows = {
  follow: vi.fn(),
  unfollow: vi.fn(),
  removeFollower: vi.fn(),
};
const users = { findPublicUsers: vi.fn() };
const webRevalidation = { revalidate: vi.fn() };

const pair = new Map([
  ['ada', { id: 'ada', username: 'ada_lovelace', name: 'Ada', image: null }],
  ['grace', { id: 'grace', username: 'grace', name: 'Grace', image: null }],
]);

describe('FollowWritesService', () => {
  let service: FollowWritesService;

  beforeEach(async () => {
    vi.clearAllMocks();
    users.findPublicUsers.mockResolvedValue(pair);
    const moduleRef = await Test.createTestingModule({
      providers: [
        FollowWritesService,
        { provide: FollowsService, useValue: follows },
        { provide: UsersService, useValue: users },
        { provide: WebRevalidationService, useValue: webRevalidation },
      ],
    }).compile();
    service = moduleRef.get(FollowWritesService);
  });

  it('follows, then refreshes the Profiles of both Users', async () => {
    await service.follow('ada', 'grace');

    expect(follows.follow).toHaveBeenCalledWith('ada', 'grace');
    expect(users.findPublicUsers).toHaveBeenCalledWith(['ada', 'grace']);
    expect(webRevalidation.revalidate).toHaveBeenCalledWith([
      'user-profile:ada_lovelace',
      'user-profile:grace',
    ]);
  });

  it('unfollows, then refreshes the Profiles of both Users', async () => {
    await service.unfollow('ada', 'grace');

    expect(follows.unfollow).toHaveBeenCalledWith('ada', 'grace');
    expect(webRevalidation.revalidate).toHaveBeenCalledWith([
      'user-profile:ada_lovelace',
      'user-profile:grace',
    ]);
  });

  it('removes a follower, then refreshes the Profiles of both Users', async () => {
    await service.removeFollower('ada', 'ada_lovelace', 'grace');

    expect(follows.removeFollower).toHaveBeenCalledWith(
      'ada',
      'ada_lovelace',
      'grace',
    );
    expect(users.findPublicUsers).toHaveBeenCalledWith(['ada', 'grace']);
    expect(webRevalidation.revalidate).toHaveBeenCalledWith([
      'user-profile:ada_lovelace',
      'user-profile:grace',
    ]);
  });

  it('skips the revalidation of a User without a username, which has no Profile', async () => {
    users.findPublicUsers.mockResolvedValue(
      new Map([
        ['ada', { id: 'ada', username: null, name: 'Ada', image: null }],
        [
          'grace',
          { id: 'grace', username: 'grace', name: 'Grace', image: null },
        ],
      ]),
    );

    await service.follow('ada', 'grace');

    expect(webRevalidation.revalidate).toHaveBeenCalledWith([
      'user-profile:grace',
    ]);
  });

  it('keeps the saved follow when the revalidation fails', async () => {
    webRevalidation.revalidate.mockRejectedValueOnce(new Error('queue down'));

    await expect(service.follow('ada', 'grace')).resolves.toBeUndefined();

    expect(follows.follow).toHaveBeenCalledWith('ada', 'grace');
  });
});
