import { expect, type Page, test } from '@playwright/test';

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

/** Everything the page logs as an error or throws while it loads. */
function collectProblems(page: Page): string[] {
  const problems: string[] = [];
  page.on('console', (message) => {
    // The 404s of resources the fake API does not serve are not what this checks.
    if (
      message.type() === 'error' &&
      !message.text().includes('Failed to load resource')
    ) {
      problems.push(message.text());
    }
  });
  page.on('pageerror', (error) => problems.push(error.message));
  return problems;
}

for (const { locale, messages } of cases) {
  const favorite = messages.tracks.practice.favorite;

  test.describe(`a completed Track page hydrates cleanly (${locale})`, () => {
    test('as a signed-in User', async ({ page }) => {
      const problems = collectProblems(page);
      await mockAuthApi(page, { user: SINGER });
      await mockFavoritesApi(page);
      const trackId = `clx-hydration-user-${locale}`;
      await setTrackMock({ tracks: [completedTrack(trackId)] });

      await page.goto(`/${locale}/tracks/${trackId}`);
      await expect(
        page.getByRole('button', { name: favorite.add }),
      ).toBeEnabled();

      expect(problems).toEqual([]);
    });

    test('as a visitor', async ({ page }) => {
      const problems = collectProblems(page);
      await mockAuthApi(page);
      const trackId = `clx-hydration-visitor-${locale}`;
      await setTrackMock({ tracks: [completedTrack(trackId)] });

      await page.goto(`/${locale}/tracks/${trackId}`);
      await expect(
        page.getByRole('link', { name: favorite.signIn }),
      ).toBeVisible();

      expect(problems).toEqual([]);
    });
  });
}
