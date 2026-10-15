import { expect, type Locator, type Page, test } from '@playwright/test';
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

    test('shows the resulting key next to the offset and goes back to the original key', async ({
      page,
    }) => {
      await openTrack(page, locale, `clx-transpose-reset-${locale}`);
      const reset = page.getByRole('button', { name: dock.transposeReset });
      await expect(reset).toHaveCount(0);

      await page.getByRole('button', { name: dock.transposeUp }).click();
      await page.getByRole('button', { name: dock.transposeUp }).click();

      await expect(page.getByTestId('transpose-key')).toHaveText(
        keyText('A', 'MAJOR'),
      );
      await expect(page.getByTestId('transpose-value')).toHaveText('+2');
      await reset.click();
      await expect(page.getByTestId('transpose-key')).toHaveText(
        keyText('G', 'MAJOR'),
      );
      await expect(page.getByTestId('transpose-value')).toHaveText('0');
      await expect(reset).toHaveCount(0);
    });

    test('has touch targets of at least 40px in the stepper', async ({
      page,
    }) => {
      await openTrack(page, locale, `clx-transpose-targets-${locale}`);
      await page.getByRole('button', { name: dock.transposeUp }).click();

      for (const name of [
        dock.transposeDown,
        dock.transposeUp,
        dock.transposeReset,
      ]) {
        const box = await page.getByRole('button', { name }).boundingBox();
        expect(box?.width).toBeGreaterThanOrEqual(40);
        expect(box?.height).toBeGreaterThanOrEqual(40);
      }
    });

    test('separates the artists, the key and the duration with one dot each', async ({
      page,
    }) => {
      const id = `clx-facts-${locale}`;
      await setTrackMock({ tracks: [track(id)] });

      await page.goto(`/${locale}/tracks/${id}`);

      const facts = page.locator('#track-title + p');
      await expect(facts).toContainText(keyText('G', 'MAJOR'));
      const text = ((await facts.textContent()) ?? '').replace(/\s+/g, ' ');
      expect(text).toContain(`Queen·${keyText('G', 'MAJOR')}·`);
      expect(text).not.toContain('··');
    });
  });
}

const dock = catalogs.en.tracks.practice.dock;

test.describe('the toast and the dock on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('sits above the dock', async ({ page }) => {
    await openTrack(page, 'en', 'clx-transpose-phone-toast');

    await page.getByRole('button', { name: dock.transposeUp }).click();

    const toast = page.locator('[data-sonner-toast]').first();
    await expect(toast).toBeVisible();
    // Sonner slides the toast in; wait for it to settle before measuring.
    await page.waitForTimeout(600);
    const toastBox = await toast.boundingBox();
    const dockBox = await page
      .getByRole('region', { name: dock.label })
      .boundingBox();
    expect(toastBox).not.toBeNull();
    expect(dockBox).not.toBeNull();
    expect((toastBox?.y ?? 0) + (toastBox?.height ?? 0)).toBeLessThanOrEqual(
      dockBox?.y ?? 0,
    );
    // It reads normally: nearly the viewport's width less the side gutters,
    // not squeezed into a column.
    expect(toastBox?.width ?? 0).toBeGreaterThan(390 - 2 * 24 - 4);
  });
});

/** The RGBA a rect is painted with, whatever color syntax the theme used. */
const paintOf = (rect: Locator) =>
  rect.evaluate((element) => {
    const context = document.createElement('canvas').getContext('2d');
    if (!context) return [0, 0, 0, 0];
    context.fillStyle = getComputedStyle(element).fill;
    context.fillRect(0, 0, 1, 1);
    return [...context.getImageData(0, 0, 1, 1).data];
  });

const brightness = ([r = 0, g = 0, b = 0]: number[]) => r + g + b;

test.describe('key and range in both themes', () => {
  for (const scheme of ['light', 'dark'] as const) {
    test(`draws a keyboard that is not inverted in ${scheme} mode, with the range in orange`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await openTrack(page, 'en', `clx-key-range-${scheme}`);

      const keyboard = page.getByRole('img', {
        name: /Keyboard with the vocal range/,
      });
      await expect(keyboard).toBeVisible();

      // Out of the range C#3-G4: the first white key (C3) and a sharp (G#4).
      const white = await paintOf(keyboard.locator('rect').first());
      const sharp = await paintOf(
        keyboard
          .locator('rect[height="22"]:not([class*="fill-primary"])')
          .last(),
      );
      const lit = await paintOf(
        keyboard.locator('rect[class*="fill-primary"]').first(),
      );

      // Black keys are never lighter than white ones, as on a piano.
      expect(brightness(sharp)).toBeLessThan(brightness(white));
      expect(lit[0]).toBeGreaterThan(200);
      expect(lit[1]).toBeLessThan(140);
      // The drawing fills its box, so it ends where the box does.
      const edges = await keyboard.evaluate((svg) => ({
        box: svg.getBoundingClientRect().right,
        keys: Math.max(
          ...[...svg.querySelectorAll('rect')].map(
            (key) => key.getBoundingClientRect().right,
          ),
        ),
      }));
      expect(edges.box - edges.keys).toBeLessThan(3);
    });
  }
});
