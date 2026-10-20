import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { cacheTags } from '@notefinder/contracts';
import { WebRevalidationService } from '../../integrations/web-revalidation/web-revalidation.service.js';
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

      await expect(service.refreshPublic()).resolves.toEqual(feedOf('v1'));

      expect(store.writeCurrent).toHaveBeenCalledWith(feedOf('v1'));
      expect(store.retire).not.toHaveBeenCalled();
      expect(revalidation.revalidate).toHaveBeenCalledWith([cacheTags.home]);
    });

    it('does not revalidate when the content did not change', async () => {
      store.readCurrent.mockResolvedValue(feedOf('v1'));
      builder.build.mockResolvedValue(feedOf('v1'));

      await service.refreshPublic();

      expect(store.writeCurrent).toHaveBeenCalledWith(feedOf('v1'));
      expect(store.retire).not.toHaveBeenCalled();
      expect(revalidation.revalidate).not.toHaveBeenCalled();
    });

    it('retains the replaced feed and revalidates when the content changed', async () => {
      store.readCurrent.mockResolvedValue(feedOf('v1'));
      builder.build.mockResolvedValue(feedOf('v2'));

      await service.refreshPublic();

      expect(store.retire).toHaveBeenCalledWith(feedOf('v1'));
      expect(store.writeCurrent).toHaveBeenCalledWith(feedOf('v2'));
      expect(revalidation.revalidate).toHaveBeenCalledWith([cacheTags.home]);
    });

    it('fails when the revalidation cannot be queued, so the job retries', async () => {
      store.readCurrent.mockResolvedValue(feedOf('v1'));
      builder.build.mockResolvedValue(feedOf('v2'));
      revalidation.revalidate.mockRejectedValue(new Error('queue down'));

      await expect(service.refreshPublic()).rejects.toThrow('queue down');
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

      await expect(service.refreshPublic()).rejects.toThrow('queue down');
      await expect(service.refreshPublic()).resolves.toEqual(feedOf('v1'));

      expect(revalidation.revalidate).toHaveBeenCalledTimes(2);
      expect(revalidation.revalidate).toHaveBeenLastCalledWith([
        cacheTags.home,
      ]);
    });
  });

  describe('currentPublic', () => {
    it('serves the stored feed without building one', async () => {
      store.readCurrent.mockResolvedValue(feedOf('v1'));

      await expect(service.currentPublic()).resolves.toEqual({
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

      await expect(service.currentPublic()).resolves.toEqual({
        feed: feedOf('v1'),
        cacheable: true,
      });
      expect(builder.build).toHaveBeenCalledOnce();
      expect(store.releaseLock).toHaveBeenCalledOnce();
    });

    it('answers the uncached minimal home while another request holds the lock', async () => {
      store.readCurrent.mockResolvedValue(undefined);
      store.acquireLock.mockResolvedValue(false);

      await expect(service.currentPublic()).resolves.toEqual({
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

      await expect(service.currentPublic()).resolves.toEqual({
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
});
