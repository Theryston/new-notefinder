import { describe, expect, it, vi } from 'vitest';
import { browserApi } from '@/lib/api/browser';
import { postTrackView } from './track-view-query';

vi.mock('@/lib/api/browser', () => ({ browserApi: vi.fn() }));

describe('postTrackView attribution', () => {
  it('sends optional click and visitor ids with a new view', async () => {
    vi.mocked(browserApi).mockResolvedValue({ viewId: 'view-1' });

    await postTrackView('track-1', undefined, 'pt-BR', {
      clickId: 'click-1',
      visitorId: 'visitor-1',
    });

    expect(browserApi).toHaveBeenCalledWith('/tracks/track-1/views', {
      method: 'POST',
      body: {
        clickId: 'click-1',
        locale: 'pt-BR',
        visitorId: 'visitor-1',
      },
      schema: expect.anything(),
    });
  });
});
