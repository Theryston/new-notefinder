import type { HomeRow, HomeTrack } from '@notefinder/contracts';
import { StreaksService } from '../streaks/streaks.service.js';
import { UsersService } from '../users/users.service.js';
import { HomeFeedService } from './home-feed.service.js';
import { PersonalHomeRepository } from './home-personal.repository.js';
import { PersonalHomeBuilder } from './home-personal-builder.service.js';

describe('PersonalHomeBuilder row composition', () => {
  it('includes the daily target and each resume row once', async () => {
    const tracks = Array.from(
      { length: 12 },
      (_, index) =>
        ({
          id: `song_${index}`,
          title: `Song ${index}`,
          coverUrl: null,
          artistCredit: [{ name: `Performer ${index}`, joinPhrase: '' }],
          durationMs: null,
          vocalRange: null,
        }) satisfies HomeTrack,
    );
    const firstTrack = tracks[0];
    if (!firstTrack) throw new Error('No public Track fixture');
    const publicRows: HomeRow[] = [
      { id: 'hero', layout: 'hero', track: firstTrack },
      {
        id: 'trending',
        layout: 'standard',
        title: { key: 'home.rows.trendingToday', params: {} },
        items: tracks,
      },
    ];
    const feeds = {
      currentPublic: vi.fn().mockResolvedValue({
        feed: {
          audience: 'public',
          locale: 'en',
          version: 'public',
          algorithmVersion: 1,
          rows: publicRows,
        },
        cacheable: true,
      }),
    };
    const signals = tracks.slice(0, 6).map((item) => ({
      trackId: item.id,
      attempts: 1,
      bestAccuracy: 0.7,
      lastAttemptAt: new Date('2026-10-20T10:00:00.000Z'),
      genres: ['rock'],
      artistKey: item.artistCredit[0]?.name ?? item.id,
      title: item.title,
      coverUrl: item.coverUrl,
      artistCredit: item.artistCredit,
      durationMs: item.durationMs,
      vocalRangeLowest: null,
      vocalRangeHighest: null,
    }));
    const personal = {
      findUserTrackSignals: vi.fn().mockResolvedValue(signals),
      findUserFavoriteSignals: vi.fn().mockResolvedValue([]),
      findDiscoveryTracks: vi.fn().mockResolvedValue(
        new Map(
          tracks.map((item, index) => [
            item.id,
            {
              trendingScore: tracks.length - index,
              genres: ['rock'],
              artistKey: item.artistCredit[0]?.name ?? item.id,
            },
          ]),
        ),
      ),
    };
    const tasteRows = {
      findUserTasteActivities: vi.fn().mockResolvedValue([]),
      build: vi.fn().mockResolvedValue([]),
      explorationRow: vi.fn().mockResolvedValue(undefined),
    };
    const builder = new PersonalHomeBuilder(
      feeds as unknown as HomeFeedService,
      personal as unknown as PersonalHomeRepository,
      {
        getStatus: vi.fn().mockResolvedValue({
          completedToday: false,
          targetSeconds: 300,
          listenedSeconds: 120,
          currentStreakDays: 2,
        }),
      } as unknown as StreaksService,
      {
        getPracticeSettings: vi.fn().mockResolvedValue({
          dailyPracticeTargetSeconds: 300,
          timeZone: 'UTC',
          lastPracticeHeartbeatAt: null,
        }),
      } as unknown as UsersService,
    );
    Object.defineProperty(builder, 'tasteRows', { value: tasteRows });

    const feed = await builder.build('user-1', 'en');
    const rowIds = feed.rows.map((row) => row.id);

    expect(new Set(rowIds).size).toBe(rowIds.length);
    expect(rowIds.filter((id) => id === 'daily-target')).toHaveLength(1);
    expect(rowIds.filter((id) => id === 'continue-singing')).toHaveLength(1);
    expect(rowIds.filter((id) => id === 'sing-again')).toHaveLength(1);
  });
});
