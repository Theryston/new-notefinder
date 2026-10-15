import { describe, expect, it, vi } from 'vitest';

import { browserApi } from '@/lib/api/browser';

import { postTrackView } from './track-view-query';

vi.mock('@/lib/api/browser', () => ({ browserApi: vi.fn() }));

const mockBrowserApi = vi.mocked(browserApi);

describe('postTrackView', () => {
  it('records a visit with an empty body and answers the view ID', async () => {
    mockBrowserApi.mockResolvedValue({ viewId: 'view-1' });

    await expect(postTrackView('a/b', undefined)).resolves.toBe('view-1');

    expect(mockBrowserApi).toHaveBeenCalledWith('/tracks/a%2Fb/views', {
      method: 'POST',
      body: {},
      schema: expect.anything(),
    });
  });

  it('sends the stored view ID to attach the signed-in User', async () => {
    mockBrowserApi.mockResolvedValue({ viewId: 'view-1' });

    await postTrackView('track-1', 'view-1');

    expect(mockBrowserApi).toHaveBeenCalledWith('/tracks/track-1/views', {
      method: 'POST',
      body: { viewId: 'view-1' },
      schema: expect.anything(),
    });
  });
});
