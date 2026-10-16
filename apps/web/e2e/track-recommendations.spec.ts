import { expect, test } from '@playwright/test';
import { type FakeTrack, setTrackMock } from './fake-track-api';
import { messages } from './messages';

for (const locale of ['en', 'pt-BR'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    for (const width of [360, 1440]) {
      test(`recommendations render and navigate: ${locale}, ${theme}, ${width}`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ colorScheme: theme });
        const id = `recommend-${locale}-${theme}-${width}`;
        const next: FakeTrack = {
          id: `${id}-next`,
          title: 'Somebody to Love',
          artistCredit: [{ name: 'Queen', joinPhrase: '' }],
          processing: { status: 'COMPLETED' },
        };
        await setTrackMock({
          tracks: [
            next,
            {
              id,
              title: 'Under Pressure',
              processing: { status: 'COMPLETED' },
              recommendations: [next],
            },
          ],
        });
        await page.goto(`/${locale}/tracks/${id}`);
        const section = page.getByRole('region', {
          name: messages[locale].tracks.practice.moreToSing,
        });
        await expect(section).toBeVisible();
        const card = section.getByRole('link', { name: /Somebody to Love/ });
        await expect(card).toBeVisible();
        await expect(section.getByText('Queen')).toBeVisible();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await card.click();
        await expect(page).toHaveURL(new RegExp(`/tracks/${next.id}$`));
        await expect(
          page.getByRole('heading', { level: 1, name: next.title }),
        ).toBeVisible();
      });
    }
  }
}

test('omits an empty recommendation list without affecting practice', async ({
  page,
}) => {
  const id = 'recommend-empty';
  await setTrackMock({
    tracks: [
      { id, title: 'No Surprises', processing: { status: 'COMPLETED' } },
    ],
  });
  await page.goto(`/en/tracks/${id}`);
  await expect(
    page.getByRole('heading', { level: 1, name: 'No Surprises' }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: messages.en.tracks.practice.moreToSing }),
  ).toHaveCount(0);
});

test('streams practice before delayed recommendations', async ({ page }) => {
  const id = 'recommend-streaming';
  await setTrackMock({
    tracks: [
      {
        id,
        title: 'Practice first',
        processing: { status: 'COMPLETED' },
        recommendationsDelayMs: 4000,
        recommendations: [
          {
            id: 'recommend-streaming-next',
            title: 'Suggestions later',
            processing: { status: 'COMPLETED' },
          },
        ],
      },
    ],
  });
  await page.goto(`/en/tracks/${id}`, { waitUntil: 'commit' });
  await expect(
    page.getByRole('heading', { level: 1, name: 'Practice first' }),
  ).toBeVisible({ timeout: 2500 });
  await expect(
    page.getByRole('heading', {
      name: messages.en.tracks.practice.noVoice.title,
    }),
  ).toBeVisible({ timeout: 1000 });
  await expect(
    page.getByRole('region', { name: messages.en.tracks.practice.moreToSing }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('link', { name: /Suggestions later/ }),
  ).toBeVisible();
});

test('refreshes server recommendations after Processing completes without reloading', async ({
  page,
}) => {
  const id = 'recommend-after-completion';
  const old: FakeTrack = {
    id: `${id}-trending`,
    title: 'Old trending suggestion',
    processing: { status: 'COMPLETED' },
  };
  const close: FakeTrack = {
    id: `${id}-range`,
    title: 'Closest vocal range',
    processing: { status: 'COMPLETED' },
  };
  await setTrackMock({
    tracks: [
      {
        id,
        title: 'Growing range',
        processing: { status: 'DETECTING_NOTES' },
        recommendations: [old],
      },
    ],
  });
  await page.goto(`/en/tracks/${id}`);
  await expect(page.getByRole('progressbar')).toBeVisible();
  await page.evaluate(() => {
    document.documentElement.dataset.recommendationVisit = 'original';
  });
  await setTrackMock({
    tracks: [
      close,
      {
        id,
        title: 'Growing range',
        processing: { status: 'COMPLETED' },
        vocalRange: { lowest: 60, highest: 72 },
        notes: [{ pitch: 60, start: 1, end: 2 }],
        recommendations: [close],
      },
    ],
  });
  await expect(
    page.getByRole('link', { name: /Closest vocal range/ }),
  ).toBeVisible({ timeout: 15000 });
  await expect(
    page.getByRole('link', { name: /Old trending suggestion/ }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.dataset.recommendationVisit,
    ),
  ).toBe('original');
});
