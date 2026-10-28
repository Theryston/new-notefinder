import { Test } from '@nestjs/testing';
import { describe, expect, it, vi } from 'vitest';
import { CacheService } from '../../redis/cache.service.js';
import { HomeSocialStore } from './home-social.store.js';

describe('HomeSocialStore', () => {
  it('reads and writes a user pair snapshot under its viewer key', async () => {
    const cache = {
      get: vi.fn().mockResolvedValue([]),
      set: vi.fn().mockResolvedValue(undefined),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [HomeSocialStore, { provide: CacheService, useValue: cache }],
    }).compile();
    const store = moduleRef.get(HomeSocialStore);

    await expect(store.read('viewer')).resolves.toEqual([]);
    await store.write('viewer', []);

    expect(cache.get).toHaveBeenCalledWith(
      'vozzify:home-social-similarity:viewer',
      expect.any(Object),
    );
    expect(cache.set).toHaveBeenCalledWith(
      'vozzify:home-social-similarity:viewer',
      [],
      604800,
    );
    await moduleRef.close();
  });
});
