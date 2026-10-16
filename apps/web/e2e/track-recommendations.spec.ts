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
