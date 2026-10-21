import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { cacheTags, type HomeRow } from '@notefinder/contracts';
import { WebRevalidationService } from '../../integrations/web-revalidation/web-revalidation.service.js';
import { HomeRepository, type HomeTrackRecord } from './home.repository.js';
import { minimalHomeFeed, type StoredHomeFeed } from './home-feed.js';
import { HomeFeedService } from './home-feed.service.js';
import { HomeFeedStore } from './home-feed.store.js';
import { HomeFeedBuilder } from './home-feed-builder.service.js';

const feedOf = (version: string): StoredHomeFeed => ({
  audience: 'public',
  version,
  algorithmVersion: 1,
  rows: [],
});

describe('HomeFeedService', () => {
  let service: HomeFeedService;
  const store = {
    readCurrent: vi.fn(),
    writeCurrent: vi.fn(),
    retire: vi.fn(),
    readRetired: vi.fn(),
    acquireLock: vi.fn(),
    releaseLock: vi.fn(),
  };
  const builder = { build: vi.fn() };
  const revalidation = { revalidate: vi.fn() };

  beforeEach(async () => {
    vi.resetAllMocks();
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    store.writeCurrent.mockResolvedValue(undefined);
    store.retire.mockResolvedValue(undefined);
    store.releaseLock.mockResolvedValue(undefined);
    revalidation.revalidate.mockResolvedValue(undefined);
    const moduleRef = await Test.createTestingModule({
      providers: [
        HomeFeedService,
        { provide: HomeFeedStore, useValue: store },
        { provide: HomeFeedBuilder, useValue: builder },
        { provide: WebRevalidationService, useValue: revalidation },
      ],
    }).compile();
    service = moduleRef.get(HomeFeedService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('refreshPublic', () => {
    it('stores a first feed and revalidates the home tag', async () => {
      store.readCurrent.mockResolvedValue(undefined);
      builder.build.mockResolvedValue(feedOf('v1'));

      await expect(service.refreshPublic('en')).resolves.toEqual(feedOf('v1'));

      expect(store.writeCurrent).toHaveBeenCalledWith('en', feedOf('v1'));
      expect(store.retire).not.toHaveBeenCalled();
      expect(revalidation.revalidate).toHaveBeenCalledWith([
        cacheTags.home('en'),
      ]);
    });

    it('does not revalidate when the content did not change', async () => {
      store.readCurrent.mockResolvedValue(feedOf('v1'));
      builder.build.mockResolvedValue(feedOf('v1'));

      await service.refreshPublic('en');

      expect(store.writeCurrent).toHaveBeenCalledWith('en', feedOf('v1'));
      expect(store.retire).not.toHaveBeenCalled();
      expect(revalidation.revalidate).not.toHaveBeenCalled();
    });

    it('retains the replaced feed and revalidates when the content changed', async () => {
      store.readCurrent.mockResolvedValue(feedOf('v1'));
      builder.build.mockResolvedValue(feedOf('v2'));

      await service.refreshPublic('en');

      expect(store.retire).toHaveBeenCalledWith(feedOf('v1'));
      expect(store.writeCurrent).toHaveBeenCalledWith('en', feedOf('v2'));
      expect(revalidation.revalidate).toHaveBeenCalledWith([
        cacheTags.home('en'),
      ]);
    });

    it('fails when the revalidation cannot be queued, so the job retries', async () => {
      store.readCurrent.mockResolvedValue(feedOf('v1'));
      builder.build.mockResolvedValue(feedOf('v2'));
      revalidation.revalidate.mockRejectedValue(new Error('queue down'));

      await expect(service.refreshPublic('en')).rejects.toThrow('queue down');
    });

    it('revalidates on the retry when the first revalidation failed', async () => {
      let stored: StoredHomeFeed | undefined;
      store.readCurrent.mockImplementation(async () => stored);
      store.writeCurrent.mockImplementation(async (feed: StoredHomeFeed) => {
        stored = feed;
      });
      builder.build.mockResolvedValue(feedOf('v1'));
      revalidation.revalidate
        .mockRejectedValueOnce(new Error('queue down'))
        .mockResolvedValue(undefined);

      await expect(service.refreshPublic('en')).rejects.toThrow('queue down');
      await expect(service.refreshPublic('en')).resolves.toEqual(feedOf('v1'));

      expect(revalidation.revalidate).toHaveBeenCalledTimes(2);
      expect(revalidation.revalidate).toHaveBeenLastCalledWith([
        cacheTags.home('en'),
      ]);
    });
  });

  describe('currentPublic', () => {
    it('serves the stored feed without building one', async () => {
      store.readCurrent.mockResolvedValue(feedOf('v1'));

      await expect(service.currentPublic('en')).resolves.toEqual({
        feed: feedOf('v1'),
        cacheable: true,
      });
      expect(builder.build).not.toHaveBeenCalled();
      expect(store.acquireLock).not.toHaveBeenCalled();
    });

    it('builds a missing feed under the lock and releases the lock', async () => {
      store.readCurrent.mockResolvedValue(undefined);
      store.acquireLock.mockResolvedValue(true);
      builder.build.mockResolvedValue(feedOf('v1'));

      await expect(service.currentPublic('en')).resolves.toEqual({
        feed: feedOf('v1'),
        cacheable: true,
      });
      expect(builder.build).toHaveBeenCalledOnce();
      expect(store.releaseLock).toHaveBeenCalledOnce();
    });

    it('answers the uncached minimal home while another request holds the lock', async () => {
      store.readCurrent.mockResolvedValue(undefined);
      store.acquireLock.mockResolvedValue(false);

      await expect(service.currentPublic('en')).resolves.toEqual({
        feed: minimalHomeFeed(),
        cacheable: false,
      });
      expect(builder.build).not.toHaveBeenCalled();
      expect(store.releaseLock).not.toHaveBeenCalled();
    });

    it('still answers when revalidating from the request fails', async () => {
      store.readCurrent.mockResolvedValue(undefined);
      store.acquireLock.mockResolvedValue(true);
      builder.build.mockResolvedValue(feedOf('v1'));
      revalidation.revalidate.mockRejectedValue(new Error('queue down'));

      await expect(service.currentPublic('en')).resolves.toEqual({
        feed: feedOf('v1'),
        cacheable: true,
      });
      expect(store.releaseLock).toHaveBeenCalledOnce();
    });
  });

  describe('publicVersion', () => {
    it('answers the current feed when the version is the current one', async () => {
      store.readCurrent.mockResolvedValue(feedOf('v2'));

      await expect(service.publicVersion('v2')).resolves.toEqual(feedOf('v2'));
      expect(store.readRetired).not.toHaveBeenCalled();
    });

    it('answers a retained feed for an older version', async () => {
      store.readCurrent.mockResolvedValue(feedOf('v2'));
      store.readRetired.mockResolvedValue(feedOf('v1'));

      await expect(service.publicVersion('v1')).resolves.toEqual(feedOf('v1'));
    });

    it('answers nothing for a version that is gone', async () => {
      store.readCurrent.mockResolvedValue(feedOf('v2'));
      store.readRetired.mockResolvedValue(undefined);

      await expect(service.publicVersion('v0')).resolves.toBeUndefined();
    });
  });

  describe('withArtistLinks', () => {
    const recordOf = (
      id: string,
      artistCredit: HomeTrackRecord['artistCredit'],
    ): HomeTrackRecord => ({
      id,
      title: `Track ${id}`,
      coverUrl: null,
      artistCredit,
      lengthMs: null,
      vocalRangeLowest: null,
      vocalRangeHighest: null,
    });

    const linkedService = async (
      records: HomeTrackRecord[],
      artists: { mbid: string; id: string }[],
    ) => {
      const repository = {
        findCompletedTracksByIds: vi.fn().mockResolvedValue(records),
        findArtistIdsByMbids: vi.fn().mockResolvedValue(artists),
      };
      const moduleRef = await Test.createTestingModule({
        providers: [
          HomeFeedService,
          { provide: HomeFeedStore, useValue: store },
          { provide: HomeFeedBuilder, useValue: builder },
          { provide: WebRevalidationService, useValue: revalidation },
          { provide: HomeRepository, useValue: repository },
        ],
      }).compile();
      return {
        service: moduleRef.get(HomeFeedService),
        repository,
      };
    };

    it('keeps rows unchanged when the repository is not wired', async () => {
      const rows: HomeRow[] = [
        {
          id: 'hero',
          layout: 'hero',
          track: {
            id: 't1',
            title: 'Hit',
            coverUrl: null,
            artistCredit: [{ name: 'Known', joinPhrase: '' }],
            durationMs: null,
            vocalRange: null,
          },
        },
      ];

      await expect(service.withArtistLinks(rows)).resolves.toBe(rows);
    });

    it('links names by their stored MBID, null otherwise', async () => {
      const { service: linked, repository } = await linkedService(
        [
          recordOf('t1', [{ name: 'Known', joinPhrase: '', mbid: 'mbid-1' }]),
          recordOf('t2', [{ name: 'Ghost', joinPhrase: '' }]),
          recordOf('t3', [{ name: 'Missing', joinPhrase: '', mbid: 'mbid-9' }]),
        ],
        [{ mbid: 'mbid-1', id: 'artist-1' }],
      );
      const rows: HomeRow[] = [
        {
          id: 'hero',
          layout: 'hero',
          track: {
            id: 't1',
            title: 'Hit',
            coverUrl: null,
            artistCredit: [{ name: 'Known', joinPhrase: '' }],
            durationMs: null,
            vocalRange: null,
          },
        },
        {
          id: 'trending-today',
          layout: 'standard',
          title: { key: 'home.rows.trendingToday', params: {} },
          items: [
            {
              id: 't2',
              title: 'Ghost song',
              coverUrl: null,
              artistCredit: [{ name: 'Ghost', joinPhrase: '' }],
              durationMs: null,
              vocalRange: null,
            },
            {
              id: 't3',
              title: 'Missing song',
              coverUrl: null,
              artistCredit: [{ name: 'Missing', joinPhrase: '' }],
              durationMs: null,
              vocalRange: null,
            },
            {
              id: 't9',
              title: 'Gone song',
              coverUrl: null,
              artistCredit: [{ name: 'Gone', joinPhrase: '' }],
              durationMs: null,
              vocalRange: null,
            },
          ],
        },
        {
          id: 'daily-target',
          layout: 'daily-target',
          title: { key: 'home.rows.dailyTarget', params: {} },
          secondsLeft: 300,
          targetSeconds: 900,
          streakDays: 2,
          completedToday: false,
        },
      ];

      const linkedRows = await linked.withArtistLinks(rows);

      const [hero, trending] = linkedRows;
      expect(hero).toMatchObject({
        layout: 'hero',
        track: {
          id: 't1',
          artistCredit: [
            { name: 'Known', joinPhrase: '', artistId: 'artist-1' },
          ],
        },
      });
      expect(trending).toMatchObject({
        layout: 'standard',
        items: [
          {
            id: 't2',
            artistCredit: [{ name: 'Ghost', joinPhrase: '', artistId: null }],
          },
          {
            id: 't3',
            artistCredit: [{ name: 'Missing', joinPhrase: '', artistId: null }],
          },
          {
            id: 't9',
            artistCredit: [{ name: 'Gone', joinPhrase: '', artistId: null }],
          },
        ],
      });
      expect(linkedRows[2]).toEqual(rows[2]);
      expect(repository.findCompletedTracksByIds).toHaveBeenCalledWith([
        't1',
        't2',
        't3',
        't9',
      ]);
      expect(repository.findArtistIdsByMbids).toHaveBeenCalledWith([
        'mbid-1',
        'mbid-9',
      ]);
    });
  });
});
