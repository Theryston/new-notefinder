import { Test } from '@nestjs/testing';
import { UsersService } from '../users/users.service.js';
import { FollowsRepository } from './follows.repository.js';
import { FollowsService } from './follows.service.js';

const follows = {
  add: vi.fn(),
  remove: vi.fn(),
  isFollowing: vi.fn(),
};
const users = {
  findPublicUsers: vi.fn(),
  findIdByUsername: vi.fn(),
};

const known = (...ids: string[]) =>
  new Map(ids.map((id) => [id, { id, username: id, name: id, image: null }]));

describe('FollowsService', () => {
  let service: FollowsService;

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        FollowsService,
        { provide: FollowsRepository, useValue: follows },
        { provide: UsersService, useValue: users },
      ],
    }).compile();
    service = moduleRef.get(FollowsService);
  });

  describe('follow', () => {
    it('records the follow of an existing User', async () => {
      users.findPublicUsers.mockResolvedValue(known('grace'));

      await service.follow('ada', 'grace');

      expect(users.findPublicUsers).toHaveBeenCalledWith(['grace']);
      expect(follows.add).toHaveBeenCalledWith('ada', 'grace');
    });

    it('refuses to follow oneself before looking anything up', async () => {
      await expect(service.follow('ada', 'ada')).rejects.toMatchObject({
        code: 'BAD_REQUEST',
      });

      expect(users.findPublicUsers).not.toHaveBeenCalled();
      expect(follows.add).not.toHaveBeenCalled();
    });

    it('answers NOT_FOUND for an unknown User and saves nothing', async () => {
      users.findPublicUsers.mockResolvedValue(new Map());

      await expect(service.follow('ada', 'nobody')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });

      expect(follows.add).not.toHaveBeenCalled();
    });
  });

  describe('unfollow', () => {
    it('removes the follow of an existing User', async () => {
      users.findPublicUsers.mockResolvedValue(known('grace'));

      await service.unfollow('ada', 'grace');

      expect(follows.remove).toHaveBeenCalledWith('ada', 'grace');
    });

    it('answers NOT_FOUND for an unknown User and removes nothing', async () => {
      users.findPublicUsers.mockResolvedValue(new Map());

      await expect(service.unfollow('ada', 'nobody')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });

      expect(follows.remove).not.toHaveBeenCalled();
    });
  });

  describe('removeFollower', () => {
    it('removes the follow of an existing follower of the Profile User', async () => {
      users.findIdByUsername.mockResolvedValue('ada');
      users.findPublicUsers.mockResolvedValue(known('grace'));

      await service.removeFollower('ada', 'ada_lovelace', 'grace');

      expect(users.findIdByUsername).toHaveBeenCalledWith('ada_lovelace');
      expect(follows.remove).toHaveBeenCalledWith('grace', 'ada');
    });

    it('answers FORBIDDEN to anyone but the Profile User and removes nothing', async () => {
      users.findIdByUsername.mockResolvedValue('ada');

      await expect(
        service.removeFollower('grace', 'ada_lovelace', 'someone'),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });

      expect(follows.remove).not.toHaveBeenCalled();
    });

    it('answers NOT_FOUND for an unknown follower and removes nothing', async () => {
      users.findIdByUsername.mockResolvedValue('ada');
      users.findPublicUsers.mockResolvedValue(new Map());

      await expect(
        service.removeFollower('ada', 'ada_lovelace', 'nobody'),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });

      expect(follows.remove).not.toHaveBeenCalled();
    });
  });

  describe('profileFollow', () => {
    it('answers the ID of the Profile User and whether the viewer follows it', async () => {
      users.findIdByUsername.mockResolvedValue('grace-id');
      follows.isFollowing.mockResolvedValue(true);

      await expect(service.profileFollow('ada', 'grace')).resolves.toEqual({
        userId: 'grace-id',
        isFollowing: true,
      });

      expect(users.findIdByUsername).toHaveBeenCalledWith('grace');
      expect(follows.isFollowing).toHaveBeenCalledWith('ada', 'grace-id');
    });
  });
});
