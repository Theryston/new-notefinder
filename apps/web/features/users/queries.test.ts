import { cacheTags, publicProfileSummarySchema } from '@notefinder/contracts';
import { cacheTag } from 'next/cache';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api/api-error';
import { serverApi } from '@/lib/api/server';

import { getPublicProfile, getPublicProfileSummary } from './queries';

vi.mock('next/cache', () => ({ cacheTag: vi.fn(), cacheLife: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/api/server', () => ({ serverApi: vi.fn() }));

const mockServerApi = vi.mocked(serverApi);

const notFound = () =>
  new ApiError({
    statusCode: 404,
    code: 'NOT_FOUND',
    message: 'User not found',
  });

const summary = {
  streakDays: 4,
  sungCount: 1250,
  favoritesCount: 7,
  contributionsCount: 1,
};

describe('getPublicProfileSummary', () => {
  beforeEach(() => {
    mockServerApi.mockReset();
  });

  it('reads the numbers of the username, encoded, with the summary schema', async () => {
    mockServerApi.mockResolvedValueOnce(summary);

    await expect(getPublicProfileSummary('ada lovelace')).resolves.toEqual(
      summary,
    );

    expect(mockServerApi).toHaveBeenCalledWith(
      '/users/ada%20lovelace/summary',
      { schema: publicProfileSummarySchema },
    );
  });

  it('answers null for a username no User has, so the section is left out', async () => {
    mockServerApi.mockRejectedValueOnce(notFound());

    await expect(getPublicProfileSummary('nobody')).resolves.toBeNull();
  });

  it('lets any other failure through to the caller', async () => {
    const failure = new Error('connection refused');
    mockServerApi.mockRejectedValueOnce(failure);

    await expect(getPublicProfileSummary('ada')).rejects.toBe(failure);
  });
});

describe('getPublicProfile', () => {
  beforeEach(() => {
    mockServerApi.mockReset();
  });

  it('reads the banner under the Profile tag of the username', async () => {
    const banner = {
      username: 'ada',
      name: 'Ada Lovelace',
      image: null,
      createdAt: '2026-01-02T03:04:05.000Z',
    };
    mockServerApi.mockResolvedValueOnce(banner);

    await expect(getPublicProfile('ada')).resolves.toEqual(banner);

    expect(cacheTag).toHaveBeenCalledWith(cacheTags.userProfile('ada'));
  });

  it('answers null for an unknown username, which the page turns into a 404', async () => {
    mockServerApi.mockRejectedValueOnce(notFound());

    await expect(getPublicProfile('nobody')).resolves.toBeNull();
  });
});
