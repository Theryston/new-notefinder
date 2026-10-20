import type { TrackContributorRepository } from './track-contributor.repository.js';
import type { TrackProcessingRepository } from './track-processing.repository.js';
import { TrackProcessingService } from './track-processing.service.js';
import type { TracksRepository } from './tracks.repository.js';

const row = (userId: string, isFollowing: boolean) => ({
  id: `contributor-${userId}`,
  userId,
  username: userId,
  name: userId,
  image: null,
  isFollowing,
  contributedAt: new Date('2026-10-08T12:00:00.000Z'),
});

// The viewer's follow flag is the only thing a viewer adds to a Contributor:
// with no viewer the item has no `isFollowing` key at all, not `false`.
describe('TrackProcessingService Contributors for a viewer', () => {
  const findContributorsPage = vi.fn();
  const tracks = {
    findTrackHeader: vi.fn().mockResolvedValue({ id: 'track-1' }),
  };
  const service = new TrackProcessingService(
    tracks as unknown as TracksRepository,
    {} as TrackProcessingRepository,
    { findContributorsPage } as unknown as TrackContributorRepository,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    tracks.findTrackHeader.mockResolvedValue({ id: 'track-1' });
  });

  it('passes the viewer to the read and gives each item its follow flag', async () => {
    findContributorsPage.mockResolvedValue({
      rows: [row('ada', true), row('grace', false)],
      total: 2,
    });

    const page = await service.listContributors(
      'track-1',
      { limit: 20 },
      'viewer',
    );

    expect(findContributorsPage).toHaveBeenCalledWith(
      'track-1',
      expect.objectContaining({ viewerId: 'viewer' }),
    );
    expect(page.items).toEqual([
      expect.objectContaining({ userId: 'ada', isFollowing: true }),
      expect.objectContaining({ userId: 'grace', isFollowing: false }),
    ]);
  });

  it('leaves the follow flag out for an anonymous viewer', async () => {
    findContributorsPage.mockResolvedValue({
      rows: [row('ada', true)],
      total: 1,
    });

    const page = await service.listContributors('track-1', { limit: 20 });

    expect(findContributorsPage).toHaveBeenCalledWith(
      'track-1',
      expect.objectContaining({ viewerId: undefined }),
    );
    expect(page.items[0]).toHaveProperty('userId', 'ada');
    expect(page.items[0]).not.toHaveProperty('isFollowing');
  });
});
