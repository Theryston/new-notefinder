import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/api-error';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ cacheTag: vi.fn(), cacheLife: vi.fn() }));
vi.mock('@/lib/api/server', () => ({ serverApi: vi.fn() }));
const { serverApi } = await import('@/lib/api/server');
const { cacheTag } = await import('next/cache');
const { getPlanCatalog } = await import('./queries');

describe('public plan catalog cache', () => {
  beforeEach(() => vi.clearAllMocks());

  it('scopes localized public data to shared catalog tags without forwarding sessions', async () => {
    const catalog = { currency: 'BRL', plans: [] };
    vi.mocked(serverApi).mockResolvedValue(catalog);
    await expect(getPlanCatalog('pt-BR')).resolves.toEqual(catalog);
    expect(serverApi).toHaveBeenCalledWith('/plans', {
      schema: expect.anything(),
      query: { locale: 'pt-BR' },
    });
    expect(cacheTag).toHaveBeenCalledWith('plans', 'plans:pt-BR');
  });

  it('lets failures reach the page error state instead of inventing empty plans', async () => {
    const error = new ApiError({
      statusCode: 503,
      code: 'INTERNAL_ERROR',
      message: 'Unavailable',
    });
    vi.mocked(serverApi).mockRejectedValue(error);
    await expect(getPlanCatalog('en')).rejects.toBe(error);
  });
});
