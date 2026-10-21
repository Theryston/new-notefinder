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

const rankedItem = (id: string, title: string) => ({
  id,
  title,
  coverUrl: null,
  artistCredit: [{ name: 'Queen', joinPhrase: '' }],
  durationMs: 354000,
  vocalRange: { lowest: 40, highest: 69 },
});

const rankedRow = (id: string, sponsored = false): FakeHomeRow => ({
  id,
  layout: 'ranked',
  ...(sponsored ? { sponsored: true } : {}),
  title: { key: 'home.rows.top10Week', params: {} },
  items: Array.from({ length: 6 }, (_, index) =>
    rankedItem(`ranked-song-${index + 1}`, `Fixture ranked song ${index + 1}`),
  ),
});

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

/**
 * Installs the fixtures and waits until the web serves them. A revalidated
 * tag is served stale once while it refreshes, so the page is polled until
 * its lead Track is the fixture's.
 */
async function installFeed(rows: FakeHomeRow[]): Promise<void> {
  await setHomeMock({ feeds: { en: rows } });
  await revalidateHome();
  const [first] = rows;
  const item = (first?.items as { id: string }[] | undefined)?.[0];
  const lead = `/en/tracks/${item?.id ?? ''}`;
  await expect
    .poll(async () => {
      const response = await fetch(`${baseURL}/en`);
      return response.text();
    })
    .toContain(lead);
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

test.describe('home ranked Top 10', () => {
  test('a ranked row numbers its Tracks and links each one', async ({
    page,
  }) => {
    await installFeed([rankedRow('top-10-week')]);

    await page.goto('/en');

    await expect(
      page.getByRole('heading', {
        level: 2,
        name: messages.en.home.rows.top10Week,
      }),
    ).toBeVisible();
    const list = page.getByRole('region', {
      name: messages.en.home.rows.top10Week,
    });
    await expect(list.getByRole('listitem')).toHaveCount(6);
    for (let position = 1; position <= 6; position += 1) {
      const link = page.getByRole('link', {
        name: new RegExp(`Fixture ranked song ${position}`),
      });
      await expect(link).toHaveAttribute(
        'href',
        `/en/tracks/ranked-song-${position}`,
      );
      await expect(link).toContainText(
        new RegExp(`^${position}\\S*Fixture ranked song ${position}`),
      );
    }
  });

  test('a sponsored ranked row shows the discreet notice, linked to the advertising terms', async ({
    page,
  }) => {
    await installFeed([rankedRow('top-10-week', true)]);

    await page.goto('/en');

    await expect(
      page.getByRole('link', { name: messages.en.home.sponsored.row }),
    ).toHaveAttribute('href', `/en/terms#${TERMS_ADVERTISING_FRAGMENT}`);
  });

  test('a ranked row without the flag shows no sponsored notice', async ({
    page,
  }) => {
    await installFeed([rankedRow('top-10-week')]);

    await page.goto('/en');

    await expect(
      page.getByRole('link', { name: messages.en.home.sponsored.row }),
    ).toHaveCount(0);
  });

  test('the ranked row renders in the dark theme too', async ({ page }) => {
    await installFeed([rankedRow('top-10-week')]);
    await page.emulateMedia({ colorScheme: 'dark' });

    await page.goto('/en');

    await expect(page.locator('html.dark')).toHaveCount(1);
    await expect(
      page.getByRole('heading', {
        level: 2,
        name: messages.en.home.rows.top10Week,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: /Fixture ranked song 1/ }),
    ).toBeVisible();
  });
});
