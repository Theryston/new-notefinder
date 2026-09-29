import { beforeEach, describe, expect, it, vi } from 'vitest';

import { trackCollectionMetadata } from './collection-metadata';
import { getTrackCollection } from './queries';

// `server-only` throws outside the react-server condition, which Vitest
// doesn't use.
vi.mock('server-only', () => ({}));
vi.mock('./queries', () => ({ getTrackCollection: vi.fn() }));

const notFoundError = new Error('NEXT_NOT_FOUND');
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw notFoundError;
  },
}));

vi.mock('next-intl/server', () => ({
  getLocale: async () => 'pt-BR',
  getTranslations: async () => (key: string, values?: { name: string }) =>
    `${key}(${values?.name ?? ''})`,
}));

const firstPage = { items: [], nextCursor: null };

beforeEach(() => {
  vi.mocked(getTrackCollection).mockResolvedValue({
    owner: { id: 'x1', name: 'Ana', trackCount: 3 },
    firstPage,
  });
});

describe('trackCollectionMetadata', () => {
  it("describes an artist's page, with its alternates", async () => {
    await expect(
      trackCollectionMetadata({ kind: 'artist', id: 'x1' }),
    ).resolves.toEqual({
      title: 'artistMetaTitle(Ana)',
      description: 'artistMetaDescription(Ana)',
      alternates: {
        canonical: '/pt-BR/artists/x1',
        languages: {
          'x-default': '/artists/x1',
          en: '/en/artists/x1',
          'pt-BR': '/pt-BR/artists/x1',
        },
      },
    });
    expect(getTrackCollection).toHaveBeenCalledWith({
      kind: 'artist',
      id: 'x1',
    });
  });

  it("describes an album's page", async () => {
    const metadata = await trackCollectionMetadata({ kind: 'album', id: 'x1' });

    expect(metadata.title).toBe('albumMetaTitle(Ana)');
    expect(metadata.description).toBe('albumMetaDescription(Ana)');
    expect(metadata.alternates?.canonical).toBe('/pt-BR/albums/x1');
  });

  it('is a 404 for an unknown ID', async () => {
    vi.mocked(getTrackCollection).mockResolvedValue(null);

    await expect(
      trackCollectionMetadata({ kind: 'album', id: 'nope' }),
    ).rejects.toBe(notFoundError);
  });
});
