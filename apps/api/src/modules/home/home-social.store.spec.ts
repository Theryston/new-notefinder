import { describe, expect, it, vi } from 'vitest';
import { HomeSocialStore } from './home-social.store.js';

describe('HomeSocialStore', () => {
  it('reads and writes a user pair snapshot under its viewer key', async () => {
    const cache = {
      get: vi.fn().mockResolvedValue([]),
      set: vi.fn().mockResolvedValue(undefined),
    };
    const store = new HomeSocialStore(cache as never);

    await expect(store.read('viewer')).resolves.toEqual([]);
    await store.write('viewer', []);

    expect(cache.get).toHaveBeenCalledWith(
      'home:social:similarity:viewer',
      expect.any(Object),
    );
    expect(cache.set).toHaveBeenCalledWith(
      'home:social:similarity:viewer',
      [],
      604800,
    );
  });
});
