import { expect, type Page, test } from '@playwright/test';
import { createTranslator } from 'next-intl';

import { type FakeTrack, setTrackMock } from './fake-track-api';
import { messages as catalogs } from './messages';

const cases = [
  { locale: 'en', messages: catalogs.en },
  { locale: 'pt-BR', messages: catalogs['pt-BR'] },
] as const;

// C#3 (49) up to G4 (67), 18 semitones: an octave and a half.
const NOTES = [
  { pitch: 49, start: 0, end: 1.5 },
  { pitch: 64, start: 2, end: 3 },
  { pitch: 67, start: 3.5, end: 5 },
];

const track = (id: string, overrides: Partial<FakeTrack> = {}): FakeTrack => ({
  id,
  title: 'Under Pressure',
  artistCredit: [{ name: 'Queen', joinPhrase: '' }],
  durationMs: 248_000,
  youtubeVideoId: 'dQw4w9WgXcQ',
  processing: { status: 'COMPLETED' },
  notes: NOTES,
  // G major, the way the API reports it.
  key: { tonic: 7, mode: 'MAJOR' },
  vocalRange: { lowest: 49, highest: 67 },
  contributors: [],
  ...overrides,
});

async function openTrack(page: Page, locale: string, id: string) {
  await setTrackMock({ tracks: [track(id)] });
  await page.goto(`/${locale}/tracks/${id}`);
}

for (const { locale, messages } of cases) {
  const dock = messages.tracks.practice.dock;
  const t = createTranslator({
    locale,
    messages,
    namespace: 'tracks.practice',
  });
  const keyText = (tonic: string, mode: 'MAJOR' | 'MINOR') =>
    t(`key.${mode}`, { tonic });
  const rangeText = (low: string, high: string, octaves: number) =>
    t('range.summary', { low, high, octaves });

  test.describe(`track key, vocal range and transpose (${locale})`, () => {
    test('shows the key in the title row and the vocal range under the timeline', async ({
      page,
    }) => {
      await openTrack(page, locale, `clx-key-range-${locale}`);

      await expect(page.getByTestId('track-key')).toHaveText(
        keyText('G', 'MAJOR'),
      );
      await expect(page.getByTestId('vocal-range')).toHaveText(
        rangeText('C#3', 'G4', 1.5),
      );
      await expect(
        page.getByRole('img', {
          name: t('range.keyboard', { low: 'C#3', high: 'G4' }),
        }),
      ).toBeVisible();
    });

    test('shows neither without a key and a range', async ({ page }) => {
      const id = `clx-key-range-none-${locale}`;
      await setTrackMock({
        tracks: [track(id, { key: undefined, vocalRange: undefined })],
      });

      await page.goto(`/${locale}/tracks/${id}`);

      await expect(
        page.getByRole('img', { name: /Under Pressure/ }),
      ).toBeVisible();
      await expect(page.getByTestId('track-key')).toHaveCount(0);
      await expect(page.getByTestId('vocal-range')).toHaveCount(0);
    });

    test('moves the notes, the key and the range, and says the video keeps its key', async ({
      page,
    }) => {
      await openTrack(page, locale, `clx-transpose-${locale}`);
      const up = page.getByRole('button', { name: dock.transposeUp });

      await up.click();
      await up.click();

      await expect(page.getByTestId('transpose-value')).toHaveText('+2');
      await expect(page.getByTestId('track-key')).toHaveText(
        keyText('A', 'MAJOR'),
      );
      await expect(page.getByTestId('vocal-range')).toHaveText(
        rangeText('D#3', 'A4', 1.5),
      );
      // The timeline's description names the notes it draws.
      await expect(
        page.getByRole('img', {
          name: t('timeline.label', {
            title: 'Under Pressure',
            count: 3,
            low: 'D#3',
            high: 'A4',
          }),
        }),
      ).toBeVisible();
      await expect(page.getByText(dock.videoKeepsKey)).toBeVisible();
    });

    test('lowers the Track and stops an octave away', async ({ page }) => {
      await openTrack(page, locale, `clx-transpose-down-${locale}`);
      const down = page.getByRole('button', { name: dock.transposeDown });

      await down.click();
      await expect(page.getByTestId('track-key')).toHaveText(
        keyText('F#', 'MAJOR'),
      );
      for (let step = 0; step < 11; step += 1) await down.click();

      await expect(page.getByTestId('transpose-value')).toHaveText('-12');
      await expect(down).toBeDisabled();
      await expect(page.getByTestId('track-key')).toHaveText(
        keyText('G', 'MAJOR'),
      );
    });

    test('keeps the transposition per Track after a reload', async ({
      page,
    }) => {
      const id = `clx-transpose-kept-${locale}`;
      await openTrack(page, locale, id);
      await page.getByRole('button', { name: dock.transposeUp }).click();
      await expect(page.getByTestId('transpose-value')).toHaveText('+1');

      await page.reload();

      await expect(page.getByTestId('transpose-value')).toHaveText('+1');
      await expect(page.getByTestId('track-key')).toHaveText(
        keyText('G#', 'MAJOR'),
      );

      // Another Track starts at its own key.
      await setTrackMock({ tracks: [track(`${id}-other`)] });
      await page.goto(`/${locale}/tracks/${id}-other`);
      await expect(page.getByTestId('transpose-value')).toHaveText('0');
    });
  });
}

test.describe('key and range in both themes', () => {
  for (const scheme of ['light', 'dark'] as const) {
    test(`shows the range strip in ${scheme} mode`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await openTrack(page, 'en', `clx-key-range-${scheme}`);

      const keyboard = page.getByRole('img', {
        name: /Keyboard with the vocal range/,
      });

      await expect(keyboard).toBeVisible();
      const litKeys = keyboard.locator(
        'rect.fill-primary, rect[class*="fill-primary"]',
      );
      await expect(litKeys.first()).toBeVisible();
    });
  }
});
