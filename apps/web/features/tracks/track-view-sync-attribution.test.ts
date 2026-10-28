import { expect, it, vi } from 'vitest';
import { postTrackView } from './track-view-query';
import { synchronizeTrackView } from './track-view-sync';

vi.mock('./track-view-query', () => ({ postTrackView: vi.fn() }));

class AttributionSessionStorage extends Map<string, string> {
  getItem(key: string): string | null {
    return this.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.set(key, value);
  }
}

it('creates a new immutable view for each home click on the same Track', async () => {
  const values = new AttributionSessionStorage();
  vi.stubGlobal('window', {
    sessionStorage: values,
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
  expect(values.get('vozzify:track-view:same-track')).toContain('click-b');
  vi.unstubAllGlobals();
});
