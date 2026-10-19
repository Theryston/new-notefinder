import { beforeEach, describe, expect, it, vi } from 'vitest';

import { serverApi } from '@/lib/api/server';

import { getPracticeHistoryFirstPage } from './practice-history-first-page';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/api/server', () => ({ serverApi: vi.fn() }));

const mockServerApi = vi.mocked(serverApi);

describe('getPracticeHistoryFirstPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reads the first page of the Profile history from the API', async () => {
    const page = { items: [], nextCursor: null };
    mockServerApi.mockResolvedValue(page);

    await expect(getPracticeHistoryFirstPage('ada_lovelace')).resolves.toBe(
      page,
    );
    expect(mockServerApi).toHaveBeenCalledWith(
      '/users/ada_lovelace/attempts',
      expect.objectContaining({ query: { limit: 20 } }),
    );
  });

  it('answers undefined when the API cannot answer, so the browser fetches it', async () => {
    mockServerApi.mockRejectedValue(new Error('API down'));

    await expect(
      getPracticeHistoryFirstPage('ada_lovelace'),
    ).resolves.toBeUndefined();
  });
});
