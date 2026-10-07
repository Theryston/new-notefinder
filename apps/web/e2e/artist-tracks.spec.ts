import { expect, test } from '@playwright/test';

import { mockAuthApi } from './auth-api-mock';
import { setArtistMock } from './fake-artist-api-server';
import { defaultArtistTracks, type FakeTrack } from './fake-artist-tracks';
import { messages as catalogs } from './messages';

const cases = [
  { locale: 'en', messages: catalogs.en },
  { locale: 'pt-BR', messages: catalogs['pt-BR'] },
] as const;

const mbidOf = (n: number): string =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const makeTrack = (
  artistId: string,
  artistName: string,
  index: number,
  overrides: Partial<FakeTrack> = {},
): FakeTrack => ({
  id: `track-table-${index}`,
  title: `Track ${index}`,
  lengthMs: 180_000 + index * 1_000,
  disambiguation: '',
  video: false,
  isrcs: index === 0 ? ['GBUM71029604'] : [],
  artists: [{ id: artistId, name: artistName }],
  genres: index === 0 ? ['rock'] : [],
  ...overrides,
});

for (const { locale, messages } of cases) {
  test.describe(`artist track table (${locale})`, () => {
    test('renders core columns with row links to the track page', async ({
      page,
    }) => {
      await mockAuthApi(page);
      const id = `artist-tracks-${locale}`;
      await setArtistMock({
        artists: [
          {
            id,
            mbid: mbidOf(3001),
            name: 'Queen',
            genres: ['rock'],
            trackCount: 2,
          },
        ],
        tracksByArtist: {
          [id]: [
            makeTrack(id, 'Queen', 1, {
              id: `track-core-1-${locale}`,
              title: 'Bohemian Rhapsody',
              lengthMs: 354_000,
              disambiguation: 'live',
              video: true,
              isrcs: ['GBUM71029604'],
              genres: ['rock', 'pop'],
            }),
            makeTrack(id, 'Queen', 2, {
              id: `track-core-2-${locale}`,
              title: 'Unknown Take',
              lengthMs: null,
              isrcs: [],
              genres: [],
            }),
          ],
        },
      });

      await page.goto(`/${locale}/artists/${id}`);

      const table = page.getByRole('table');
      await expect(table).toBeVisible();
      for (const header of [
        messages.artists.tracks.columns.title,
        messages.artists.tracks.columns.artists,
        messages.artists.tracks.columns.duration,
        messages.artists.tracks.columns.isrcs,
        messages.artists.tracks.columns.genres,
      ]) {
        await expect(
          table.getByRole('columnheader', { name: header }),
        ).toBeVisible();
      }

      await expect(table.getByText('Bohemian Rhapsody')).toBeVisible();
      await expect(table.getByText('live')).toBeVisible();
      await expect(
        table.getByText(messages.artists.tracks.video),
      ).toBeVisible();
      await expect(table.getByText('5:54')).toBeVisible();
      await expect(table.getByText('GBUM71029604')).toBeVisible();
      // Unknown length, ISRCs and genres render the translated placeholder.
      await expect(table.getByText('—')).toHaveCount(3);
      await expect(
        table.getByRole('link', { name: /Bohemian Rhapsody/ }),
      ).toHaveAttribute('href', `/${locale}/tracks/track-core-1-${locale}`);
      await expect(
        table.getByRole('link', { name: /Unknown Take/ }),
      ).toHaveAttribute('href', `/${locale}/tracks/track-core-2-${locale}`);
    });

    test('loads the next page from the button without a full-page reload', async ({
      page,
    }) => {
      await mockAuthApi(page);
      // The infinite-scroll sentinel would race the explicit button, so
      // neutralize it: this test covers the button path only.
      await page.addInitScript(() => {
        const RealObserver = window.IntersectionObserver;
        window.IntersectionObserver = class extends RealObserver {
          override observe(): void {}
        };
      });
      const id = `artist-pages-${locale}`;
      const tracks: FakeTrack[] = [];
      for (let index = 0; index < 22; index += 1) {
        const padded = String(index).padStart(2, '0');
        tracks.push(
          makeTrack(id, 'Queen', index, {
            id: `track-pag-${locale}-${padded}`,
            title: `Paged Track ${padded}`,
          }),
        );
      }
      await setArtistMock({
        artists: [
          {
            id,
            mbid: mbidOf(3002),
            name: 'Queen',
            genres: [],
            trackCount: 22,
          },
        ],
        tracksByArtist: { [id]: tracks },
      });

      await page.goto(`/${locale}/artists/${id}`);

      const table = page.getByRole('table');
      await expect(table.getByText('Paged Track 00')).toBeVisible();
      const loadMore = page.getByRole('button', {
        name: messages.artists.tracks.loadMore,
      });
      await expect(loadMore).toBeVisible();
      const urlBefore = page.url();

      await loadMore.click();
      await expect(table.getByText('Paged Track 21')).toBeVisible();
      expect(page.url()).toBe(urlBefore);
      await expect(table.getByText('Paged Track 00')).toBeVisible();
    });

    test('loads the next page on scroll without a full-page reload', async ({
      page,
    }) => {
      await mockAuthApi(page);
      const id = `artist-scroll-${locale}`;
      const tracks: FakeTrack[] = [];
      for (let index = 0; index < 22; index += 1) {
        const padded = String(index).padStart(2, '0');
        tracks.push(
          makeTrack(id, 'Queen', index, {
            id: `track-scroll-${locale}-${padded}`,
            title: `Scrolled Track ${padded}`,
          }),
        );
      }
      await setArtistMock({
        artists: [
          {
            id,
            mbid: mbidOf(3005),
            name: 'Queen',
            genres: [],
            trackCount: 22,
          },
        ],
        tracksByArtist: { [id]: tracks },
      });

      await page.goto(`/${locale}/artists/${id}`);

      const table = page.getByRole('table');
      await expect(table.getByText('Scrolled Track 00')).toBeVisible();
      const urlBefore = page.url();

      await table.getByText('Scrolled Track 19').scrollIntoViewIfNeeded();
      await expect(table.getByText('Scrolled Track 21')).toBeVisible();
      expect(page.url()).toBe(urlBefore);
      await expect(table.getByText('Scrolled Track 00')).toBeVisible();
    });

    test('stays readable on small screens', async ({ page }) => {
      await mockAuthApi(page);
      await page.setViewportSize({ width: 360, height: 800 });

      await page.goto(`/${locale}/artists/clx456def`);

      await expect(page.getByRole('table')).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });

    test('shows an empty state for an artist with no tracks', async ({
      page,
    }) => {
      await mockAuthApi(page);
      const id = `artist-empty-${locale}`;
      await setArtistMock({
        artists: [
          {
            id,
            mbid: mbidOf(3003),
            name: 'Queen',
            genres: [],
            trackCount: 0,
          },
        ],
        tracksByArtist: { [id]: [] },
      });

      await page.goto(`/${locale}/artists/${id}`);

      await expect(
        page.getByText(messages.artists.tracks.empty.title),
      ).toBeVisible();
    });

    test('keeps the header with a retryable error when tracks fail', async ({
      page,
    }) => {
      await mockAuthApi(page);
      const id = `artist-broken-${locale}`;
      await setArtistMock({
        artists: [
          {
            id,
            mbid: mbidOf(3004),
            name: 'Queen',
            genres: [],
            trackCount: 1,
          },
        ],
        tracksErrorByArtist: {
          [id]: { status: 500, code: 'INTERNAL_ERROR' },
        },
      });

      await page.goto(`/${locale}/artists/${id}`);

      // The header still paints; only the table shows the error UI. The
      // query client retries 500s, so the error surfaces after ~7s.
      await expect(
        page.getByRole('heading', { level: 1, name: 'Queen' }),
      ).toBeVisible();
      await expect(
        page.getByText(messages.artists.tracks.error.title),
      ).toBeVisible({ timeout: 20_000 });
      await page
        .getByRole('button', { name: messages.artists.tracks.error.retry })
        .click();
      await expect(
        page.getByText(messages.artists.tracks.error.title),
      ).toBeVisible({ timeout: 20_000 });
    });
  });
}

test.describe('artist track table defaults', () => {
  test('default artist lists its sample tracks with links', async ({
    page,
  }) => {
    await mockAuthApi(page);
    await page.goto('/en/artists/clx456def');

    const table = page.getByRole('table');
    await expect(table).toBeVisible();
    for (const track of defaultArtistTracks) {
      await expect(
        table.getByRole('link', { name: new RegExp(track.title) }),
      ).toHaveAttribute('href', `/en/tracks/${track.id}`);
    }
  });
});
