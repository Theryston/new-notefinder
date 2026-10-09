import { expect, test } from '@playwright/test';

import { ADA, mockAuthApi } from './auth-api-mock';
import {
  type FakeTrack,
  SIGNED_IN_COOKIE,
  setTrackMock,
} from './fake-track-api';
import { messages as catalogs } from './messages';

const cases = [
  { locale: 'en', messages: catalogs.en },
  { locale: 'pt-BR', messages: catalogs['pt-BR'] },
] as const;

/** A signed-in User with a username: the one who can try again. */
const SINGER = { ...ADA, username: 'ada_singer' };

/** A Track whose Processing failed; a retry can pick it up unless overridden. */
const failedTrack = (
  id: string,
  processing: Partial<NonNullable<FakeTrack['processing']>> = {},
): FakeTrack => ({
  id,
  title: 'Retry Demo',
  artistCredit: [],
  contributors: [],
  processing: {
    status: 'FAILED',
    failureCode: 'INTERNAL',
    retryable: true,
    resumeFrom: 'FINDING_VIDEO',
    video: null,
    ...processing,
  },
});

for (const { locale, messages } of cases) {
  const tryAgain = messages.tracks.processing.retry.action;
  const signIn = messages.tracks.processing.retry.signIn;
  const completedTitle = messages.tracks.processing.completed.title;

  test.describe(`track retry (${locale})`, () => {
    test('a signed-in visitor tries again and the page follows the new Processing to completion', async ({
      page,
    }) => {
      await page
        .context()
        .addCookies([{ ...SIGNED_IN_COOKIE, domain: 'localhost', path: '/' }]);
      await mockAuthApi(page, { user: SINGER });
      const trackId = `clx-retry-ok-${locale}`;
      await setTrackMock({ tracks: [failedTrack(trackId)] });
      await page.goto(`/${locale}/tracks/${trackId}`);

      await page.getByRole('button', { name: tryAgain }).click();
      await expect(page.getByRole('button', { name: tryAgain })).toHaveCount(0);
      await expect(page.getByRole('progressbar')).toBeVisible();

      // The Processing completes on the server; the polling picks it up.
      await setTrackMock({
        tracks: [
          {
            ...failedTrack(trackId),
            processing: {
              status: 'COMPLETED',
              failureCode: null,
              retryable: false,
              resumeFrom: null,
              video: null,
            },
          },
        ],
      });
      await expect(
        page.getByRole('heading', { name: completedTitle }),
      ).toBeVisible({ timeout: 10_000 });
    });

    test('a signed-out visitor is sent to sign in, and comes back to the Track', async ({
      page,
    }) => {
      await mockAuthApi(page);
      const trackId = `clx-retry-out-${locale}`;
      await setTrackMock({ tracks: [failedTrack(trackId)] });
      await page.goto(`/${locale}/tracks/${trackId}`);

      const link = page.getByRole('link', { name: signIn });
      await expect(link).toBeVisible();
      await link.click();

      await expect(page).toHaveURL(/\/sign-in\?/);
      await expect(page).toHaveURL(
        new RegExp(`redirectTo=%2Ftracks%2F${trackId}`),
      );
    });

    test('a failure a retry cannot fix offers no Try again', async ({
      page,
    }) => {
      await page
        .context()
        .addCookies([{ ...SIGNED_IN_COOKIE, domain: 'localhost', path: '/' }]);
      await mockAuthApi(page, { user: SINGER });
      const trackId = `clx-retry-final-${locale}`;
      await setTrackMock({
        tracks: [
          failedTrack(trackId, {
            failureCode: 'VIDEO_NOT_FOUND',
            retryable: false,
            resumeFrom: 'FINDING_VIDEO',
          }),
        ],
      });
      await page.goto(`/${locale}/tracks/${trackId}`);

      await expect(
        page.getByRole('heading', {
          name: messages.tracks.processing.failed.title,
        }),
      ).toBeVisible();
      await expect(page.getByRole('button', { name: tryAgain })).toHaveCount(0);
      await expect(page.getByRole('link', { name: signIn })).toHaveCount(0);
    });
  });
}
