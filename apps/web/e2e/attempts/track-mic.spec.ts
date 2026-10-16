import { expect, type Page, test } from '@playwright/test';

import { mockAttemptsApi } from '../attempts-api-mock';
import { ADA, mockAuthApi } from '../auth-api-mock';
import { type FakeTrack, setTrackMock } from '../fake-track-api';
import { messages as catalogs } from '../messages';

// This file saves real runs, so it belongs to the chromium-mic project whose
// fake WAV sings A4: every note below is an A4 the voice hits.
test.use({ permissions: ['microphone'] });

const SINGER = { ...ADA, username: 'ada_singer' };

const cases = [
  { locale: 'en', messages: catalogs.en },
  { locale: 'pt-BR', messages: catalogs['pt-BR'] },
] as const;

/** A short Track of nothing but A4s, so a full run scores 100%. */
const sungTrack = (id: string): FakeTrack => ({
  id,
  title: 'All A4',
  durationMs: 12000,
  youtubeVideoId: 'dQw4w9WgXcQ',
  processing: { status: 'COMPLETED' },
  notes: [
    { pitch: 69, start: 0.5, end: 4 },
    { pitch: 69, start: 4.1, end: 8 },
    { pitch: 69, start: 8.1, end: 11.5 },
  ],
});

async function openTrack(page: Page, id: string, locale: string) {
  await page.addInitScript(() => {
    localStorage.setItem(
      'notefinder.singing-aids.v1',
      JSON.stringify({ countIn: false, guideMelody: false, offset: 0 }),
    );
  });
  await setTrackMock({ tracks: [sungTrack(id)] });
  await page.goto(`/${locale}/tracks/${id}`);
}

/** Sings the Track through to the result sheet. */
async function singThrough(
  page: Page,
  messages: (typeof cases)[number]['messages'],
) {
  const t = messages;
  await page
    .getByRole('button', { name: t.practice.mic.on, exact: true })
    .click();
  await expect(page.getByTestId('detected-note')).toHaveText('A4');
  await page
    .getByRole('button', { name: t.tracks.practice.dock.play, exact: true })
    .click();
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('result-accuracy')).toHaveText('100%');
}

const bestScoreOf = (
  messages: (typeof cases)[number]['messages'],
  percent: number,
) => messages.practice.scoring.bestScore.replace('{percent}', String(percent));

const pendingKey = (trackId: string) => `notefinder:pending-attempt:${trackId}`;

for (const { locale, messages } of cases) {
  test.describe(`saved attempts (${locale})`, () => {
    test('a signed-in User run is saved and the best score shows', async ({
      page,
    }) => {
      await mockAuthApi(page, { user: SINGER });
      const api = await mockAttemptsApi(page);
      const trackId = `clx-attempt-save-${locale}`;
      await openTrack(page, trackId, locale);

      await singThrough(page, messages);

      await expect.poll(() => api.attempts.length).toBe(1);
      expect(api.attempts[0]).toMatchObject({
        trackId,
        body: {
          difficulty: 'NORMAL',
          octaveMode: 'ANY',
          transposeSemitones: 0,
          speed: 1,
          accuracy: 1,
          coverage: 1,
          forwardSkip: false,
        },
      });
      const expected = bestScoreOf(messages, 100);
      await expect(
        page.getByRole('dialog').getByTestId('best-score'),
      ).toHaveText(expected);
      await page
        .getByRole('button', { name: messages.practice.scoring.close })
        .click();
      await expect(
        page
          .locator('section[aria-labelledby="track-title"]')
          .getByTestId('best-score'),
      ).toHaveText(expected);
    });

    test('a visitor run waits for sign-in and is submitted after', async ({
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
      const api = await mockAttemptsApi(page);
      const trackId = `clx-attempt-pending-${locale}`;
      await openTrack(page, trackId, locale);

      await singThrough(page, messages);
      expect(api.attempts).toEqual([]);
      await expect(
        page
          .getByRole('link', { name: messages.practice.scoring.signInToSave })
          .first(),
      ).toBeVisible();
      const waiting = await page.evaluate(
        (key) => window.sessionStorage.getItem(key),
        pendingKey(trackId),
      );
      expect(waiting).not.toBeNull();

      await page
        .getByRole('link', { name: messages.practice.scoring.signInToSave })
        .first()
        .click();
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
      await expect.poll(() => api.attempts.length).toBe(1);
      expect(api.attempts[0]).toMatchObject({ trackId });
      await expect
        .poll(() =>
          page.evaluate(
            (key) => window.sessionStorage.getItem(key),
            pendingKey(trackId),
          ),
        )
        .toBeNull();
      await expect(
        page
          .locator('section[aria-labelledby="track-title"]')
          .getByTestId('best-score'),
      ).toHaveText(bestScoreOf(messages, 100));
    });
  });
}
