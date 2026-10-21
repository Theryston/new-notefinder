import { expect, test } from '@playwright/test';

import { TERMS_ADVERTISING_FRAGMENT } from '../lib/terms-fragments';
import {
  defaultHomeRows,
  type FakeHomeRow,
  setHomeMock,
} from './fake-home-api';
import { messages } from './messages';
import { webServerEnv } from './web-server-env';

const baseURL = 'http://localhost:3000';

type FakeTrackCard = {
  id: string;
  title: string;
  artist: string;
};

const card = (id: string, title: string): FakeTrackCard => ({
  id,
  title,
  artist: 'Queen',
});

const toItem = ({ id, title, artist }: FakeTrackCard) => ({
  id,
  title,
  coverUrl: null,
  artistCredit: [{ name: artist, joinPhrase: '' }],
  durationMs: 354000,
  vocalRange: { lowest: 40, highest: 69 },
});

const hero = (id: string, sponsored = false): FakeHomeRow => ({
  id: 'hero',
  layout: 'hero',
  ...(sponsored ? { sponsored: true } : {}),
  track: toItem(card(id, 'Fixture lead song')),
});

// Each fixture gets its own lead Track, so `installFeed` can tell the feed it
// installed from a stale one a previous test left in the web cache.
let fixtureSeq = 0;
const uniqueId = (prefix: string): string => `${prefix}-${++fixtureSeq}`;

const genresKey = 'home.rows.genres';
const featuredArtistsKey = 'home.rows.featuredArtists';
const featuredAlbumsKey = 'home.rows.featuredAlbums';

/** Clears the web's cached feeds so the next visit renders the new fixture. */
async function revalidateHome(): Promise<void> {
  const response = await fetch(`${baseURL}/api/revalidate`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${webServerEnv.REVALIDATE_SECRET}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ tags: ['home:en', 'home:pt-BR'] }),
  });
  expect(response.ok).toBe(true);
}

type HomeFixtures = {
  en?: FakeHomeRow[];
  'pt-BR'?: FakeHomeRow[];
};

/** The id of the first Track a feed shows: the hero's, or the first card's. */
function leadTrackId(rows: FakeHomeRow[]): string {
  const [first] = rows;
  const track = first?.track as { id: string } | undefined;
  const item = (first?.items as { id: string }[] | undefined)?.[0];
  return track?.id ?? item?.id ?? '';
}

/**
 * Installs the fixtures and waits until the web serves them. A revalidated
 * tag is served stale once while it refreshes, so the page is polled until
 * its lead Track is the fixture's.
 */
async function installFeed(feeds: HomeFixtures): Promise<void> {
  await setHomeMock({ feeds });
  await revalidateHome();
  for (const [locale, rows] of Object.entries(feeds) as [
    string,
    FakeHomeRow[],
  ][]) {
    const lead = `/${locale}/tracks/${leadTrackId(rows)}`;
    await expect
      .poll(async () => {
        const response = await fetch(`${baseURL}/${locale}`);
        return response.text();
      })
      .toContain(lead);
  }
}

// The fake API and the web cache are shared by the whole file, so the specs
// run one after another, each installing its own feed first.
test.describe.configure({ mode: 'serial' });

// The fake API keeps the last feed installed, and every suite shares the
// web's home. Put the default feed back once this file is done.
test.afterAll(async () => {
  await setHomeMock({
    feeds: { en: defaultHomeRows('en'), 'pt-BR': defaultHomeRows('pt-BR') },
  });
  await revalidateHome();
});

test.describe('home discovery rows', () => {
  test('a visitor sees the genre tiles, each a real link to its search', async ({
    page,
  }) => {
    await installFeed({
      en: [
        hero(uniqueId('en-hero')),
        {
          id: 'genres',
          layout: 'genres',
          title: { key: genresKey, params: {} },
          items: [{ name: 'Rock' }, { name: 'R&B' }],
        },
      ],
    });

    await page.goto('/en');

    await expect(
      page.getByRole('heading', {
        level: 2,
        name: messages.en.home.rows.genres,
      }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Rock' })).toHaveAttribute(
      'href',
      '/en/search?q=Rock',
    );
    await expect(page.getByRole('link', { name: 'R&B' })).toHaveAttribute(
      'href',
      '/en/search?q=R%26B',
    );
  });

  test('a visitor sees the featured artists, each a real link to its page', async ({
    page,
  }) => {
    await installFeed({
      en: [
        hero(uniqueId('en-hero')),
        {
          id: 'featured-artists',
          layout: 'artists',
          title: { key: featuredArtistsKey, params: {} },
          items: [
            { id: 'en-artist-1', name: 'Fixture artist one' },
            { id: 'en-artist-2', name: 'Fixture artist two' },
          ],
        },
      ],
    });

    await page.goto('/en');

    await expect(
      page.getByRole('heading', {
        level: 2,
        name: messages.en.home.rows.featuredArtists,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Fixture artist one' }),
    ).toHaveAttribute('href', '/en/artists/en-artist-1');
    await expect(
      page.getByRole('link', { name: 'Fixture artist two' }),
    ).toHaveAttribute('href', '/en/artists/en-artist-2');
  });

  test('a visitor sees the featured albums, each a real link to its page', async ({
    page,
  }) => {
    await installFeed({
      en: [
        hero(uniqueId('en-hero')),
        {
          id: 'featured-albums',
          layout: 'albums',
          title: { key: featuredAlbumsKey, params: {} },
          items: [
            {
              id: 'en-album-1',
              title: 'Fixture album one',
              coverArtUrl: null,
              year: 1975,
            },
          ],
        },
      ],
    });

    await page.goto('/en');

    await expect(
      page.getByRole('heading', {
        level: 2,
        name: messages.en.home.rows.featuredAlbums,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: /Fixture album one/ }),
    ).toHaveAttribute('href', '/en/albums/en-album-1');
  });

  test('a sponsored artists row shows the discreet notice', async ({
    page,
  }) => {
    await installFeed({
      en: [
        hero(uniqueId('en-hero')),
        {
          id: 'featured-artists',
          layout: 'artists',
          sponsored: true,
          title: { key: featuredArtistsKey, params: {} },
          items: [{ id: 'en-artist-1', name: 'Fixture artist one' }],
        },
      ],
    });

    await page.goto('/en');
    await expect(
      page.getByRole('link', {
        name: messages.en.home.sponsored.row,
        exact: true,
      }),
    ).toHaveAttribute('href', `/en/terms#${TERMS_ADVERTISING_FRAGMENT}`);
  });
});
