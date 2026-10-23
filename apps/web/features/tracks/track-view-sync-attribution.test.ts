import { afterEach, expect, it, vi } from 'vitest';
import { postTrackView } from './track-view-query';
import { synchronizeTrackView } from './track-view-sync';

vi.mock('./track-view-query', () => ({ postTrackView: vi.fn() }));
afterEach(() => vi.unstubAllGlobals());

it('creates a new immutable view for each home click on the same Track', async () => {
  const values = new Map<string, string>();
  vi.stubGlobal('window', {
    sessionStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
  vi.mocked(postTrackView)
    .mockResolvedValueOnce('view-a')
    .mockResolvedValueOnce('view-b');

  await synchronizeTrackView('same-track', true, 'en', {
    clickId: 'click-a',
    visitorId: 'visitor-1',
  });
  await synchronizeTrackView('same-track', true, 'en', {
    clickId: 'click-b',
    visitorId: 'visitor-1',
  });

  expect(postTrackView).toHaveBeenNthCalledWith(
    1,
    'same-track',
    undefined,
    'en',
    { clickId: 'click-a', visitorId: 'visitor-1' },
  );
  expect(postTrackView).toHaveBeenNthCalledWith(
    2,
    'same-track',
    undefined,
    'en',
    { clickId: 'click-b', visitorId: 'visitor-1' },
  );
  expect(values.get('notefinder:track-view:same-track')).toContain('click-b');
});
