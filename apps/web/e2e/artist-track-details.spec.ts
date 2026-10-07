import { expect, test } from '@playwright/test';

import { mockAuthApi } from './auth-api-mock';
import { setArtistMock } from './fake-artist-api-server';
import type { FakeTrack } from './fake-artist-tracks';
import { messages as catalogs } from './messages';

const cases = [
  { locale: 'en', messages: catalogs.en },
  { locale: 'pt-BR', messages: catalogs['pt-BR'] },
] as const;

const mbidOf = (n: number): string =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const makeDetailedTrack = (
  artistId: string,
  trackId: string,
  title: string,
): FakeTrack => ({
  id: trackId,
  title,
  lengthMs: 354_000,
  disambiguation: '',
  video: false,
  isrcs: ['GBUM71029604'],
  artists: [{ id: artistId, name: 'Queen' }],
  genres: ['rock'],
  releases: [
    {
      mbid: mbidOf(2101),
      title: 'A Night at the Opera',
      year: 1975,
      coverArtUrl: 'https://coverartarchive.org/release/2101/front-500',
    },
    {
      mbid: mbidOf(2102),
      title: 'Greatest Hits',
      year: null,
      coverArtUrl: null,
    },
  ],
  works: [{ mbid: mbidOf(3101), title: 'Bohemian Rhapsody work' }],
  tags: [
    { name: 'rock', count: 10 },
    { name: 'classic', count: 5 },
  ],
  externalLinks: [
    { url: 'https://open.spotify.com/track/123', linkType: 'streaming' },
  ],
});

const makeEmptyTrack = (
  artistId: string,
  trackId: string,
  title: string,
): FakeTrack => ({
  id: trackId,
  title,
  lengthMs: null,
  disambiguation: '',
  video: false,
  isrcs: [],
  artists: [{ id: artistId, name: 'Queen' }],
  genres: [],
  releases: [],
  works: [],
  tags: [],
  externalLinks: [],
});

for (const { locale, messages } of cases) {
  test.describe(`artist track details (${locale})`, () => {
    test('expands and collapses the MusicBrainz sections', async ({ page }) => {
      await mockAuthApi(page);
      const id = `artist-details-${locale}`;
      const track = makeDetailedTrack(
        id,
        `track-details-1-${locale}`,
        'Bohemian Rhapsody',
      );
      await setArtistMock({
        artists: [
          {
            id,
            mbid: mbidOf(3006),
            name: 'Queen',
            genres: ['rock'],
            trackCount: 1,
          },
        ],
        tracksByArtist: { [id]: [track] },
      });

      await page.goto(`/${locale}/artists/${id}`);

      const details = messages.artists.tracks.details;
      const expandName = details.expand.replace('{title}', 'Bohemian Rhapsody');
      const collapseName = details.collapse.replace(
        '{title}',
        'Bohemian Rhapsody',
      );
      const expand = page.getByRole('button', { name: expandName });
      await expect(expand).toHaveAttribute('aria-expanded', 'false');

      // Hidden until expanded.
      await expect(page.getByText('A Night at the Opera')).toHaveCount(0);

      await expand.click();
      const collapse = page.getByRole('button', { name: collapseName });
      await expect(collapse).toHaveAttribute('aria-expanded', 'true');
      await expect(page.getByText('A Night at the Opera')).toBeVisible();
      await expect(page.getByText('Greatest Hits')).toBeVisible();
      await expect(page.getByText('(1975)')).toBeVisible();
      await expect(page.getByText('Bohemian Rhapsody work')).toBeVisible();
      await expect(page.getByText('rock')).toBeVisible();
      await expect(
        page.getByRole('link', { name: 'streaming' }),
      ).toHaveAttribute('href', 'https://open.spotify.com/track/123');

      for (const heading of [
        details.releases,
        details.works,
        details.tags,
        details.links,
      ]) {
        await expect(
          page.getByRole('heading', { name: heading }),
        ).toBeVisible();
      }

      await collapse.click();
      await expect(
        page.getByRole('button', { name: expandName }),
      ).toHaveAttribute('aria-expanded', 'false');
      await expect(page.getByText('A Night at the Opera')).toHaveCount(0);
    });

    test('toggles with the keyboard and shows empty states', async ({
      page,
    }) => {
      await mockAuthApi(page);
      const id = `artist-details-empty-${locale}`;
      const track = makeEmptyTrack(
        id,
        `track-empty-1-${locale}`,
        'Unknown Take',
      );
      await setArtistMock({
        artists: [
          {
            id,
            mbid: mbidOf(3007),
            name: 'Queen',
            genres: [],
            trackCount: 1,
          },
        ],
        tracksByArtist: { [id]: [track] },
      });

      await page.goto(`/${locale}/artists/${id}`);

      const details = messages.artists.tracks.details;
      const expandName = details.expand.replace('{title}', 'Unknown Take');
      const collapseName = details.collapse.replace('{title}', 'Unknown Take');
      const expand = page.getByRole('button', { name: expandName });

      await expand.focus();
      await page.keyboard.press('Enter');
      await expect(
        page.getByRole('button', { name: collapseName }),
      ).toHaveAttribute('aria-expanded', 'true');

      for (const empty of [
        details.noReleases,
        details.noWorks,
        details.noTags,
        details.noLinks,
      ]) {
        await expect(page.getByText(empty)).toBeVisible();
      }

      await page.keyboard.press('Enter');
      await expect(
        page.getByRole('button', { name: expandName }),
      ).toHaveAttribute('aria-expanded', 'false');
    });
  });
}

test.describe('artist track details defaults', () => {
  test('default track expands to its sample sections', async ({ page }) => {
    await mockAuthApi(page);
    await page.goto('/en/artists/clx456def');

    const expand = page.getByRole('button', {
      name: 'Show details for Bohemian Rhapsody',
    });
    await expand.click();

    await expect(page.getByText('A Night at the Opera')).toBeVisible();
    await expect(page.getByText('Bohemian Rhapsody work')).toBeVisible();
  });
});
