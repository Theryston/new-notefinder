import type { PublicProfile } from '@vozzify/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getPublicFavoritesPage,
  getPublicProfile,
  getPublicProfileSummary,
} from '@/features/users/queries';

import { getProfileOgSource } from './profile-og-source';

vi.mock('server-only', () => ({}));
vi.mock('@/features/users/queries', () => ({
  getPublicProfile: vi.fn(),
  getPublicProfileSummary: vi.fn(),
  getPublicFavoritesPage: vi.fn(),
}));

const mockGetPublicProfile = vi.mocked(getPublicProfile);
const mockGetSummary = vi.mocked(getPublicProfileSummary);
const mockGetFavorites = vi.mocked(getPublicFavoritesPage);

/**
 * A banner as the API answers it, with the hideable sections of the Profile
 * page added on top. The preview must read none of those.
 */
const bannerWithSections: PublicProfile &
  Record<'summary' | 'favorites' | 'history', unknown> = {
  username: 'ada_lovelace',
  name: 'Ada Lovelace',
  image: 'https://images.example.com/ada.png',
  createdAt: '2026-01-02T03:04:05.000Z',
  dailyPracticeTargetSeconds: 900,
  vocalRange: { lowest: 48, highest: 74 },
  mostSungArtist: { id: 'artist-1', name: 'Queen' },
  followersCount: 12,
  followingCount: 3,
  friendsCount: 2,
  summary: { streakDays: 12, sungCount: 340, favoritesCount: 9 },
  favorites: [{ id: 'track-9', title: 'Hidden favorite' }],
  history: [{ id: 'attempt-1', accuracy: 0.91 }],
};

describe('getProfileOgSource', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reads the banner of the Profile through the page cache, and nothing else', async () => {
    mockGetPublicProfile.mockResolvedValueOnce(bannerWithSections);

    await getProfileOgSource('ada_lovelace');

    expect(mockGetPublicProfile).toHaveBeenCalledWith('ada_lovelace');
    expect(mockGetSummary).not.toHaveBeenCalled();
    expect(mockGetFavorites).not.toHaveBeenCalled();
  });

  it('keeps only the banner and chip fields, never section data', async () => {
    mockGetPublicProfile.mockResolvedValueOnce(bannerWithSections);

    const source = await getProfileOgSource('ada_lovelace');

    expect(source).toEqual({
      username: 'ada_lovelace',
      name: 'Ada Lovelace',
      image: 'https://images.example.com/ada.png',
      dailyPracticeTargetSeconds: 900,
      vocalRange: { lowest: 48, highest: 74 },
      mostSungArtist: { id: 'artist-1', name: 'Queen' },
    });
  });

  it('answers null for a Profile that does not exist', async () => {
    mockGetPublicProfile.mockResolvedValueOnce(null);

    await expect(getProfileOgSource('nobody')).resolves.toBeNull();
  });

  it('answers null when the API cannot be reached, so no preview is drawn', async () => {
    mockGetPublicProfile.mockRejectedValueOnce(new Error('connection refused'));

    await expect(getProfileOgSource('ada_lovelace')).resolves.toBeNull();
  });
});
