import { expect, type Page, test } from '@playwright/test';

import { messages } from './messages';
import { coverUrl, mockCollections } from './mock-api/fixtures';

const { artist, album, emptyArtist } = mockCollections;

const cards = (page: Page) => page.getByRole('main').getByRole('article');

/** Wheels down to the bottom, as a visitor would (not a jump to the button). */
async function scrollToEnd(page: Page) {
  await page.mouse.move(640, 360);
  await expect(async () => {
    await page.mouse.wheel(0, 2000);
    expect(
      await page.evaluate(
        () =>
          window.innerHeight + window.scrollY >= document.body.scrollHeight - 1,
      ),
    ).toBe(true);
  }).toPass();
}

test.describe('artist page', () => {
  test('shows the artist, its song count and the first page of cards', async ({
    page,
  }) => {
    const t = messages.en.tracks;
    const response = await page.goto(`/en/artists/${artist.owner.id}`);
    expect(response?.status()).toBe(200);

    await expect(page).toHaveTitle(
      `${t.collection.artistMetaTitle.replace('{name}', artist.owner.name)} | NoteFinder`,
    );
    await expect(
      page.getByRole('heading', { level: 1, name: artist.owner.name }),
    ).toBeVisible();
    await expect(page.getByRole('main')).toContainText(
      `${artist.owner.trackCount} songs with notes`,
    );
    await expect(cards(page)).toHaveCount(24);
  });

  test('renders a card with its cover, range, title and artist', async ({
    page,
  }) => {
    await page.goto(`/en/artists/${artist.owner.id}`);
    const [first] = artist.pages[0] ?? [];
    const card = cards(page).first();

    // The smallest cover that is still sharp at the card's size.
    await expect(card.locator('img')).toHaveAttribute(
      'src',
      coverUrl('track-0'),
    );
    await expect(card).toContainText('E3–A#4');
    // The whole card is a single link, to the track.
    await expect(card.getByRole('link')).toHaveCount(1);
    await expect(
      card.getByRole('link', { name: first?.title ?? '' }),
    ).toHaveAttribute('href', `/en/tracks/${first?.id}`);
    await expect(card).toContainText(artist.owner.name);
  });

  test('lists every artist of a track and falls back for missing data', async ({
    page,
  }) => {
    await page.goto(`/en/artists/${artist.owner.id}`);

    await expect(cards(page).nth(1)).toContainText(
      'Marília Mendonça and Maiara & Maraisa',
    );
    await page.goto(`/pt-BR/artists/${artist.owner.id}`);
    await expect(cards(page).nth(1)).toContainText(
      'Marília Mendonça e Maiara & Maraisa',
    );
    await page.goto(`/en/artists/${artist.owner.id}`);
    const untitled = cards(page).nth(2);
    await expect(untitled).toContainText(messages.en.tracks.card.untitled);
    await expect(untitled).not.toContainText('–');
    await expect(cards(page).nth(3).locator('img')).toHaveCount(0);
  });

  test('loads the next pages as the visitor scrolls', async ({ page }) => {
    const browserPages: string[] = [];
    page.on('request', (request) => {
      if (/\/tracks\?cursor=/.test(request.url())) {
        browserPages.push(request.url());
      }
    });
    await page.goto(`/en/artists/${artist.owner.id}`);
    await expect(cards(page)).toHaveCount(24);
    await expect(
      page.getByRole('button', { name: messages.en.tracks.list.loadMore }),
    ).toBeVisible();
    // Nothing more is fetched until the visitor heads for the end.
    expect(browserPages).toEqual([]);

    await scrollToEnd(page);

    await expect(cards(page)).toHaveCount(artist.owner.trackCount);
    expect(browserPages).toHaveLength(1);
    await expect(cards(page).last()).toContainText('Song 29');
    // The last page has no cursor: nothing more to load.
    await expect(
      page.getByRole('button', { name: messages.en.tracks.list.loadMore }),
    ).toHaveCount(0);
  });

  test('offers a retry when a page fails to load', async ({ page }) => {
    let fail = true;
    // Only the browser's requests: the first page came from the server.
    await page.route(/\/v1\/artists\/[^/]+\/tracks\?/, async (route) => {
      if (fail) {
        await route.fulfill({
          status: 500,
          json: { statusCode: 500, code: 'INTERNAL_ERROR', message: 'boom' },
        });
        return;
      }
      await route.fallback();
    });
    await page.goto(`/en/artists/${artist.owner.id}`);
    const { list } = messages.en.tracks;

    await expect(cards(page)).toHaveCount(24);
    await scrollToEnd(page);
    // Next's route announcer is an (empty) alert too.
    await expect(
      page.getByRole('main').getByRole('alert').filter({ hasText: list.error }),
    ).toBeVisible({
      // Failed fetches are retried with backoff before the error shows.
      timeout: 15_000,
    });

    fail = false;
    await page.getByRole('button', { name: list.retry }).click();
    await expect(cards(page)).toHaveCount(artist.owner.trackCount);
  });

  test('is translated and declares its alternates', async ({ page }) => {
    const t = messages['pt-BR'].tracks.collection;
    await page.goto(`/pt-BR/artists/${artist.owner.id}`);

    await expect(page).toHaveTitle(
      `${t.artistMetaTitle.replace('{name}', artist.owner.name)} | NoteFinder`,
    );
    await expect(page.getByRole('main')).toContainText(t.artist);
    await expect(page.getByRole('main')).toContainText('30 músicas com notas');
    // Streamed to browsers: it lands at the end of <body>, where bots that
    // run JavaScript (Googlebot) read it.
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      new RegExp(`/pt-BR/artists/${artist.owner.id}$`),
    );
  });

  // HTML-only crawlers, and Lighthouse (its UA token in lighthouserc.cjs),
  // get blocking metadata in <head> (Next's default `htmlLimitedBots`).
  for (const userAgent of [
    'facebookexternalhit/1.1',
    'Mozilla/5.0 (Macintosh) Chrome/136.0.0.0 Safari/537.36 Chrome-Lighthouse',
  ]) {
    test(`sends its metadata in <head> to ${userAgent.split(/[/ ]/)[0]}`, async ({
      request,
    }) => {
      const response = await request.get(`/en/artists/${artist.owner.id}`, {
        headers: { 'user-agent': userAgent },
      });
      const head = (await response.text()).split('</head>')[0] ?? '';
      const { artistMetaTitle, artistMetaDescription } =
        messages.en.tracks.collection;
      const name = artist.owner.name;

      expect(head).toContain(
        `<title>${artistMetaTitle.replace('{name}', name)} | NoteFinder</title>`,
      );
      expect(head).toContain(artistMetaDescription.replace('{name}', name));
      expect(head).toMatch(
        new RegExp(
          `rel="canonical" href="[^"]*/en/artists/${artist.owner.id}"`,
        ),
      );
    });
  }

  test('answers HTML-only crawlers a real 404 for an unknown ID', async ({
    request,
  }) => {
    for (const path of ['/en/artists/unknown-artist', '/en/albums/nope']) {
      const response = await request.get(path, {
        headers: { 'user-agent': 'facebookexternalhit/1.1' },
      });
      expect(response.status(), path).toBe(404);
    }
  });

  test('shows no cards for an artist without songs', async ({ page }) => {
    await page.goto(`/en/artists/${emptyArtist.owner.id}`);

    await expect(page.getByRole('main')).toContainText(
      'No songs with notes yet',
    );
    await expect(cards(page)).toHaveCount(0);
  });

  test('shows the not-found page for an unknown artist', async ({ page }) => {
    await page.goto('/en/artists/unknown-artist');

    // Browsers get a streamed page: the status is already sent (200), so
    // `noindex` is what keeps it out of search results.
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('404');
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute(
      'content',
      /noindex/,
    );
  });
});

test.describe('album page', () => {
  test('shows the album and all its songs', async ({ page }) => {
    const t = messages.en.tracks.collection;
    const response = await page.goto(`/en/albums/${album.owner.id}`);
    expect(response?.status()).toBe(200);

    await expect(page).toHaveTitle(
      `${t.albumMetaTitle.replace('{name}', album.owner.name)} | NoteFinder`,
    );
    await expect(page.getByRole('main')).toContainText(t.album);
    await expect(
      page.getByRole('heading', { level: 1, name: album.owner.name }),
    ).toBeVisible();
    await expect(cards(page)).toHaveCount(3);
    // A single page: nothing to load after it.
    await expect(
      page.getByRole('button', { name: messages.en.tracks.list.loadMore }),
    ).toHaveCount(0);
  });

  test('shows the not-found page for an unknown album', async ({ page }) => {
    await page.goto('/en/albums/unknown-album');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('404');
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute(
      'content',
      /noindex/,
    );
  });
});
