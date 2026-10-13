import { expect, test } from '@playwright/test';

import { ADA, mockAuthApi } from './auth-api-mock';
import { type FakeTrack, setTrackMock } from './fake-track-api';
import { mockFavoritesApi } from './favorites-api-mock';
import { messages as catalogs } from './messages';

const cases = [
  { locale: 'en', messages: catalogs.en },
  { locale: 'pt-BR', messages: catalogs['pt-BR'] },
] as const;

const SINGER = { ...ADA, username: 'ada_singer' };

const completedTrack = (id: string): FakeTrack => ({
  id,
  title: 'Under Pressure',
  artistCredit: [{ name: 'Queen', joinPhrase: '' }],
  durationMs: 248_000,
  processing: { status: 'COMPLETED' },
  notes: [{ note: 'E', octave: 4, start: 2, end: 3 }],
  contributors: [],
});

for (const { locale, messages } of cases) {
  const favorite = messages.tracks.practice.favorite;

  test.describe(`favorite a Track (${locale})`, () => {
    test('a visitor goes to sign in and comes back to the same Track', async ({
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
      await mockFavoritesApi(page);
      const trackId = `clx-favorite-visitor-${locale}`;
      await setTrackMock({ tracks: [completedTrack(trackId)] });
      await page.goto(`/${locale}/tracks/${trackId}`);

      await page.getByRole('link', { name: favorite.signIn }).click();

      await expect(page).toHaveURL(
        `/${locale}/sign-in?redirectTo=${encodeURIComponent(`/tracks/${trackId}`)}`,
      );
      await page
        .getByLabel(messages.auth.signIn.emailOrUsername.label)
        .fill(SINGER.email);
      await page
        .getByLabel(messages.auth.fields.password.label, { exact: true })
        .fill('analytical-1843');
      await page
        .getByRole('button', { name: messages.auth.signIn.submit })
        .click();

      await expect(page).toHaveURL(`/${locale}/tracks/${trackId}`);
      await expect(
        page.getByRole('button', { name: favorite.add }),
      ).toBeEnabled();
    });

    test('a signed-in User favorites and unfavorites, and the heart remembers', async ({
      page,
    }) => {
      await mockAuthApi(page, { user: SINGER });
      const api = await mockFavoritesApi(page);
      const trackId = `clx-favorite-toggle-${locale}`;
      await setTrackMock({ tracks: [completedTrack(trackId)] });
      await page.goto(`/${locale}/tracks/${trackId}`);

      const add = page.getByRole('button', { name: favorite.add });
      await expect(add).toHaveAttribute('aria-pressed', 'false');
      await add.click();

      const remove = page.getByRole('button', { name: favorite.remove });
      await expect(remove).toHaveAttribute('aria-pressed', 'true');
      await page.reload();
      await expect(
        page.getByRole('button', { name: favorite.remove }),
      ).toHaveAttribute('aria-pressed', 'true');

      await page.getByRole('button', { name: favorite.remove }).click();

      await expect(
        page.getByRole('button', { name: favorite.add }),
      ).toHaveAttribute('aria-pressed', 'false');
      expect(api.writes).toEqual(['PUT', 'DELETE']);
    });

    test('puts the heart back and explains when the request fails', async ({
      page,
    }) => {
      await mockAuthApi(page, { user: SINGER });
      await mockFavoritesApi(page, { failAddWith: 500 });
      const trackId = `clx-favorite-fail-${locale}`;
      await setTrackMock({ tracks: [completedTrack(trackId)] });
      await page.goto(`/${locale}/tracks/${trackId}`);

      await page.getByRole('button', { name: favorite.add }).click();

      await expect(
        page.getByText(messages.errors.INTERNAL_ERROR),
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: favorite.add }),
      ).toHaveAttribute('aria-pressed', 'false');
    });
  });
}
