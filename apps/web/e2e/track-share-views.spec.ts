import { expect, type Page, test } from '@playwright/test';

import { ADA, mockAuthApi } from './auth-api-mock';
import { type FakeTrack, setTrackMock } from './fake-track-api';
import { messages as catalogs } from './messages';
import { mockViewsApi } from './views-api-mock';

const cases = [
  { locale: 'en', messages: catalogs.en },
  { locale: 'pt-BR', messages: catalogs['pt-BR'] },
] as const;

const SINGER = { ...ADA, username: 'ada_singer' };

const completedTrack = (id: string, viewCount = 0): FakeTrack => ({
  id,
  title: 'Under Pressure',
  artistCredit: [{ name: 'Queen', joinPhrase: '' }],
  durationMs: 248_000,
  youtubeVideoId: 'dQw4w9WgXcQ',
  processing: { status: 'COMPLETED' },
  notes: [{ pitch: 64, start: 2, end: 3 }],
  contributors: [],
  viewCount,
});

/** Plays a moment of the Track and pauses, so the share moment is not 0. */
async function playAMoment(page: Page, dock: { play: string; pause: string }) {
  const play = page.getByRole('button', { name: dock.play });
  await expect(play).toBeEnabled();
  await play.click();
  const progress = page.getByRole('slider');
  await expect
    .poll(async () =>
      Number(await progress.first().getAttribute('aria-valuenow')),
    )
    .toBeGreaterThanOrEqual(1);
  await page.getByRole('button', { name: dock.pause }).click();
}

const clipboardText = (page: Page) =>
  page.evaluate(() => navigator.clipboard.readText());

for (const { locale, messages } of cases) {
  const { share, dock } = messages.tracks.practice;
  const momentLabel = share.includeMoment.replace('({time})', '').trim();

  test.describe(`share a Track (${locale})`, () => {
    test.beforeEach(async ({ context }) => {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    });

    test('copies a link with the current moment by default', async ({
      page,
      baseURL,
    }) => {
      const trackId = `clx-share-moment-${locale}`;
      await setTrackMock({ tracks: [completedTrack(trackId)] });
      await page.goto(`/${locale}/tracks/${trackId}`);
      await playAMoment(page, dock);

      await page.getByRole('button', { name: share.open }).click();
      const box = page.getByRole('checkbox', {
        name: new RegExp(`^${momentLabel}`),
      });
      await expect(box).toBeChecked();
      await page.getByRole('button', { name: share.copy }).click();

      await expect(page.getByText(share.copied).first()).toBeVisible();
      const copied = await clipboardText(page);
      expect(copied).toMatch(
        new RegExp(`^${baseURL}/${locale}/tracks/${trackId}\\?time=\\d+$`),
      );
      await expect(page.getByLabel(share.link)).toHaveValue(copied);
    });

    test('copies the plain link once the moment is left out', async ({
      page,
      baseURL,
    }) => {
      const trackId = `clx-share-plain-${locale}`;
      await setTrackMock({ tracks: [completedTrack(trackId)] });
      await page.goto(`/${locale}/tracks/${trackId}`);
      await playAMoment(page, dock);

      await page.getByRole('button', { name: share.open }).click();
      await page
        .getByRole('checkbox', { name: new RegExp(`^${momentLabel}`) })
        .uncheck();
      await page.getByRole('button', { name: share.copy }).click();

      await expect(page.getByText(share.copied).first()).toBeVisible();
      expect(await clipboardText(page)).toBe(
        `${baseURL}/${locale}/tracks/${trackId}`,
      );
    });

    test('offers a shortcut for every network, carrying the link', async ({
      page,
    }) => {
      const trackId = `clx-share-networks-${locale}`;
      await setTrackMock({ tracks: [completedTrack(trackId)] });
      await page.goto(`/${locale}/tracks/${trackId}`);

      await page.getByRole('button', { name: share.open }).click();

      const networks = page.getByRole('list', { name: share.networks });
      for (const name of Object.values(share.network)) {
        await expect(networks.getByRole('link', { name })).toBeVisible();
      }
      await expect(
        networks.getByRole('link', { name: share.network.whatsapp }),
      ).toHaveAttribute(
        'href',
        new RegExp(`^https://wa\\.me/\\?text=.*${trackId}`),
      );
      await expect(
        networks.getByRole('link', { name: share.network.email }),
      ).toHaveAttribute('href', /^mailto:\?subject=/);
    });
  });

  test.describe(`Track views (${locale})`, () => {
    test('shows the view count with the locale number format', async ({
      page,
    }) => {
      await mockViewsApi(page);
      const trackId = `clx-views-count-${locale}`;
      await setTrackMock({ tracks: [completedTrack(trackId, 1234)] });
      await page.goto(`/${locale}/tracks/${trackId}`);

      const formatted = new Intl.NumberFormat(locale).format(1234);
      await expect(
        page.getByText(new RegExp(`^${formatted}\\s`)),
      ).toBeVisible();
    });
  });
}

test.describe('Track views', () => {
  test('posts a view once per browser session', async ({ page }) => {
    const api = await mockViewsApi(page);
    const trackId = 'clx-views-once';
    await setTrackMock({ tracks: [completedTrack(trackId)] });

    await page.goto(`/en/tracks/${trackId}`);
    await expect.poll(() => api.posts.length).toBe(1);
    expect(api.posts[0]).toEqual({ trackId, body: {} });

    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'Under Pressure' }),
    ).toBeVisible();
    // Give a second post the time it would need to show up.
    await page.waitForTimeout(500);
    expect(api.posts).toHaveLength(1);
  });

  test('attaches the User who signs in later to the session view', async ({
    page,
  }) => {
    let signedIn = false;
    await mockAuthApi(page, {
      overrides: {
        '/sign-in/email': () => {
          signedIn = true;
          return { body: { redirect: false, token: 'token', user: SINGER } };
        },
        '/get-session': () => ({
          body: signedIn ? { session: { id: 'ses_1' }, user: SINGER } : null,
        }),
      },
    });
    const api = await mockViewsApi(page);
    const trackId = 'clx-views-attach';
    await setTrackMock({ tracks: [completedTrack(trackId)] });
    await page.goto(`/en/tracks/${trackId}`);
    await expect.poll(() => api.posts.length).toBe(1);

    await page
      .getByRole('link', {
        name: catalogs.en.tracks.practice.favorite.signIn,
      })
      .click();
    await page
      .getByLabel(catalogs.en.auth.signIn.emailOrUsername.label)
      .fill(SINGER.email);
    await page
      .getByLabel(catalogs.en.auth.fields.password.label, { exact: true })
      .fill('analytical-1843');
    await page
      .getByRole('button', { name: catalogs.en.auth.signIn.submit })
      .click();

    await expect(page).toHaveURL(`/en/tracks/${trackId}`);
    await expect.poll(() => api.posts.length).toBe(2);
    expect(api.posts[1]).toEqual({ trackId, body: { viewId: 'view-1' } });
  });
});

test.describe('Tracks sitemap', () => {
  test('lists the completed Tracks by trending score at the legacy URL, and nothing past it', async ({
    request,
  }) => {
    await setTrackMock({
      tracks: [
        completedTrack('clx-sitemap-cold', 3),
        completedTrack('clx-sitemap-hot', 900),
        {
          ...completedTrack('clx-sitemap-processing', 5000),
          processing: { status: 'QUEUED' },
        },
      ],
    });

    const response = await request.get('/tracks/sitemap/0.xml');

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/xml');
    const xml = await response.text();
    const hot = xml.indexOf('/en/tracks/clx-sitemap-hot');
    const cold = xml.indexOf('/en/tracks/clx-sitemap-cold');
    expect(hot).toBeGreaterThan(-1);
    expect(cold).toBeGreaterThan(hot);
    expect(xml).toContain('/pt-BR/tracks/clx-sitemap-hot');
    expect(xml).not.toContain('clx-sitemap-processing');

    // Past the last file, and a path that is not a file. The same test, after
    // the first read: the sitemap caches its first page.
    expect((await request.get('/tracks/sitemap/7.xml')).status()).toBe(404);
    expect((await request.get('/tracks/sitemap/nope.xml')).status()).toBe(404);
  });
});
