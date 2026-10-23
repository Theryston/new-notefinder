import { describe, expect, it, vi } from 'vitest';
import { HomeSocialService } from './home-social.service.js';

const candidate = (id: string, username = id) => ({
  id,
  username,
  name: username,
  image: null,
  practiceTrackIds: ['track-a', 'track-b'],
  favoriteTrackIds: ['track-b', 'track-c'],
});

describe('HomeSocialService', () => {
  it('stores distinct practice and favorite overlap counts with range distance', async () => {
    const repository = {
      findSignals: vi.fn().mockResolvedValue({
        viewerPracticeTrackIds: ['track-a'],
        viewerFavoriteTrackIds: ['track-b'],
        profiles: [candidate('person')],
      }),
    };
    const store = { write: vi.fn() };
    const attempts = {
      vocalRangesForUsers: vi.fn().mockResolvedValue(
        new Map([
          ['viewer', { lowest: 40, highest: 60 }],
          ['person', { lowest: 42, highest: 63 }],
        ]),
      ),
    };
    const service = new HomeSocialService(
      repository as never,
      {} as never,
      store as never,
      attempts as never,
    );

    await service.refreshFor('viewer');

    expect(store.write).toHaveBeenCalledWith('viewer', [
      {
        id: 'person',
        username: 'person',
        name: 'person',
        image: null,
        practiceCommonTracks: 2,
        favoriteCommonTracks: 1,
        bothCommonTracks: 1,
        vocalDistance: 5,
      },
    ]);
  });

  it('uses live section visibility to mask stored overlap counts', async () => {
    const pairs = Array.from({ length: 7 }, (_, index) => ({
      id: `person-${index}`,
      username: `person-${index}`,
      name: `Person ${index}`,
      image: null,
      practiceCommonTracks: 3,
      favoriteCommonTracks: 3,
      bothCommonTracks: 2,
      vocalDistance: index,
    }));
    const visibility = {
      getShownSectionsByUserIds: vi.fn().mockResolvedValue(
        new Map(
          pairs.map((pair, index) => [
            pair.id,
            {
              username: index === 6 ? null : pair.username,
              shown: {
                summary: true,
                practiceHistory: index !== 0,
                favorites: true,
              },
            },
          ]),
        ),
      ),
    };
    const store = { read: vi.fn().mockResolvedValue(pairs) };
    const service = new HomeSocialService(
      {} as never,
      visibility as never,
      store as never,
      {} as never,
    );

    const rows = await service.rowsFor('viewer');

    expect(rows).toHaveLength(2);
    expect(rows[0]?.items).toHaveLength(6);
    expect(
      rows[0]?.items.find((person) => person.id === 'person-0'),
    ).toMatchObject({
      commonTracks: 3,
    });
    expect(
      rows[0]?.items.find((person) => person.id === 'person-1'),
    ).toMatchObject({
      commonTracks: 4,
    });
    expect(visibility.getShownSectionsByUserIds).toHaveBeenCalledWith(
      pairs.map((pair) => pair.id),
    );
  });

  it('returns no social rows until a batch snapshot exists', async () => {
    const store = { read: vi.fn().mockResolvedValue(undefined) };
    const visibility = { getShownSectionsByUserIds: vi.fn() };
    const service = new HomeSocialService(
      {} as never,
      visibility as never,
      store as never,
      {} as never,
    );

    await expect(service.rowsFor('viewer')).resolves.toEqual([]);
    expect(visibility.getShownSectionsByUserIds).not.toHaveBeenCalled();
  });
});
