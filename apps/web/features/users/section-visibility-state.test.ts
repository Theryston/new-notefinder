import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api/api-error';
import { browserApi } from '@/lib/api/browser';
import { serverApi } from '@/lib/api/server';
import { sectionShown } from './hooks/use-section-visibility';
import { profileVisibilityQueryOptions } from './profile-visibility-query';
import { getPublicSectionVisibility } from './queries';
import { getSectionVisibilityLabels } from './section-visibility-labels';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ cacheTag: vi.fn(), cacheLife: vi.fn() }));
vi.mock('@/lib/api/server', () => ({ serverApi: vi.fn() }));
vi.mock('@/lib/api/browser', () => ({ browserApi: vi.fn() }));
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(async () => (key: string) => `label:${key}`),
}));

const mockServerApi = vi.mocked(serverApi);
const mockBrowserApi = vi.mocked(browserApi);

const flags = { summary: true, practiceHistory: false, favorites: true };

describe('sectionShown', () => {
  it('follows the owner’s flag once the owner’s flags have loaded', () => {
    expect(
      sectionShown({
        section: 'practiceHistory',
        owner: true,
        hiddenForVisitors: false,
        flags,
      }),
    ).toBe(false);
    expect(
      sectionShown({
        section: 'favorites',
        owner: true,
        hiddenForVisitors: true,
        flags,
      }),
    ).toBe(true);
  });

  it('keeps the server’s layout until the owner’s flags load', () => {
    expect(
      sectionShown({
        section: 'favorites',
        owner: true,
        hiddenForVisitors: true,
        flags: undefined,
      }),
    ).toBe(false);
  });

  it('shows a visitor the section as the server laid it out', () => {
    expect(
      sectionShown({
        section: 'summary',
        owner: false,
        hiddenForVisitors: false,
        flags,
      }),
    ).toBe(true);
    expect(
      sectionShown({
        section: 'summary',
        owner: false,
        hiddenForVisitors: true,
        flags,
      }),
    ).toBe(false);
  });
});

describe('getSectionVisibilityLabels', () => {
  it('reads the owner’s strings of the visibility block', async () => {
    await expect(getSectionVisibilityLabels()).resolves.toEqual({
      visible: 'label:visible',
      hidden: 'label:hidden',
      saved: 'label:saved',
      failed: 'label:failed',
    });
  });
});

describe('profileVisibilityQueryOptions', () => {
  beforeEach(() => {
    mockBrowserApi.mockReset();
  });

  it('reads the owner’s flags from the API when fetched', async () => {
    mockBrowserApi.mockResolvedValueOnce(flags);
    const { queryFn } = profileVisibilityQueryOptions();
    if (typeof queryFn !== 'function') throw new Error('no query function');

    await expect(queryFn({} as never)).resolves.toEqual(flags);
    expect(mockBrowserApi).toHaveBeenCalledWith(
      '/me/profile-visibility',
      expect.objectContaining({}),
    );
  });
});

describe('getPublicSectionVisibility', () => {
  beforeEach(() => {
    mockServerApi.mockReset();
  });

  it('reads the flags a visitor sees of the Profile', async () => {
    mockServerApi.mockResolvedValueOnce(flags);

    await expect(getPublicSectionVisibility('ada_lovelace')).resolves.toEqual(
      flags,
    );
    expect(mockServerApi).toHaveBeenCalledWith(
      '/users/ada_lovelace/sections',
      expect.objectContaining({}),
    );
  });

  it('answers null for an unknown username', async () => {
    mockServerApi.mockRejectedValueOnce(
      new ApiError({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'User not found',
      }),
    );

    await expect(getPublicSectionVisibility('nobody')).resolves.toBeNull();
  });
});
