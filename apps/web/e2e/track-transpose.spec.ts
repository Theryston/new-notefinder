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
  // The stepper lives in a popover behind the dock's chip, named by the key.
  const openTranspose = (page: Page, key: string) =>
    page
      .getByRole('button', { name: t('dock.transposeOpen', { key }) })
      .click();

  test.describe(`track key and transpose (${locale})`, () => {
    test('keeps the chip and adjacent controls still when the key changes', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await openTrack(page, locale, `clx-transpose-stable-${locale}`);
      const chip = (tonic: string) =>
        page.getByRole('button', {
          name: t('dock.transposeOpen', { key: keyText(tonic, 'MAJOR') }),
        });
      const settings = page.getByRole('button', { name: dock.settings });
      const before = await chip('G').boundingBox();
      const controlsBefore = await settings.boundingBox();
      expect(before).not.toBeNull();
      expect(controlsBefore).not.toBeNull();
      await chip('G').click();
      for (const tonic of ['G#', 'A']) {
        await page.getByRole('button', { name: dock.transposeUp }).click();
        await expect(chip(tonic)).toBeVisible();
        expect(await chip(tonic).boundingBox()).toEqual(before);
        expect(await settings.boundingBox()).toEqual(controlsBefore);
      }
    });

    test('shows the key in the transpose chip', async ({ page }) => {
      await openTrack(page, locale, `clx-key-range-${locale}`);
      await openTranspose(page, keyText('G', 'MAJOR'));

      await expect(page.getByTestId('transpose-key')).toHaveText(
        keyText('G', 'MAJOR'),
      );
    });

    test('shows no key without one', async ({ page }) => {
      const id = `clx-key-range-none-${locale}`;
      await setTrackMock({
        tracks: [track(id, { key: undefined })],
      });

      await page.goto(`/${locale}/tracks/${id}`);

      await expect(
        page.getByRole('img', { name: /Under Pressure/ }),
      ).toBeVisible();
      await page.getByRole('button', { name: dock.transpose }).click();
      await expect(page.getByTestId('transpose-key')).toHaveCount(0);
    });

    test('moves the notes and the key, and says the video keeps its key', async ({
      page,
    }) => {
      await openTrack(page, locale, `clx-transpose-${locale}`);
      await openTranspose(page, keyText('G', 'MAJOR'));
      const up = page.getByRole('button', { name: dock.transposeUp });

      await up.click();
      await up.click();

      await expect(page.getByTestId('transpose-value')).toHaveText('+2');
      await expect(page.getByTestId('transpose-key')).toHaveText(
        keyText('A', 'MAJOR'),
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
      await openTranspose(page, keyText('G', 'MAJOR'));
      const down = page.getByRole('button', { name: dock.transposeDown });

      await down.click();
      await expect(page.getByTestId('transpose-key')).toHaveText(
        keyText('F#', 'MAJOR'),
      );
      for (let step = 0; step < 11; step += 1) await down.click();

      await expect(page.getByTestId('transpose-value')).toHaveText('-12');
      await expect(down).toBeDisabled();
      await expect(page.getByTestId('transpose-key')).toHaveText(
        keyText('G', 'MAJOR'),
      );
    });

    test('keeps the transposition per Track after a reload', async ({
      page,
    }) => {
      const id = `clx-transpose-kept-${locale}`;
      await openTrack(page, locale, id);
      await openTranspose(page, keyText('G', 'MAJOR'));
      await page.getByRole('button', { name: dock.transposeUp }).click();
      await expect(page.getByTestId('transpose-value')).toHaveText('+1');

      await page.reload();
      await openTranspose(page, keyText('G#', 'MAJOR'));

      await expect(page.getByTestId('transpose-value')).toHaveText('+1');
      await expect(page.getByTestId('transpose-key')).toHaveText(
        keyText('G#', 'MAJOR'),
      );

      // Another Track starts at its own key.
      await setTrackMock({ tracks: [track(`${id}-other`)] });
      await page.goto(`/${locale}/tracks/${id}-other`);
      await openTranspose(page, keyText('G', 'MAJOR'));
      await expect(page.getByTestId('transpose-value')).toHaveText('0');
    });

    test('shows the resulting key next to the offset and goes back to the original key', async ({
      page,
    }) => {
      await openTrack(page, locale, `clx-transpose-reset-${locale}`);
      await openTranspose(page, keyText('G', 'MAJOR'));
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
      await openTranspose(page, keyText('G', 'MAJOR'));
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

    test('keeps the key in the transpose chip and separates the track facts', async ({
      page,
    }) => {
      const id = `clx-facts-${locale}`;
      await setTrackMock({ tracks: [track(id)] });

      await page.goto(`/${locale}/tracks/${id}`);

      const facts = page.locator('#track-title + p');
      const text = ((await facts.textContent()) ?? '').replace(/\s+/g, ' ');
      expect(text).toContain('Queen');
      expect(text).toContain(t('durationLabel', { duration: '4:08' }));
      expect(text).toContain(t('views', { count: 0 }));
      await expect(facts.locator('span[aria-hidden="true"]')).toHaveCount(2);
      expect(text).not.toContain('··');
      const key = keyText('G', 'MAJOR');
      const chip = page.getByRole('button', {
        name: t('dock.transposeOpen', { key }),
      });
      await expect(chip).toBeVisible();
      await expect(chip).toContainText(key);
    });
  });
}

const dock = catalogs.en.tracks.practice.dock;

test.describe('the transpose popover on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('opens above the chip, inside the screen', async ({ page }) => {
    await openTrack(page, 'en', 'clx-transpose-phone-popover');
    const chip = page.getByRole('button', {
      name: dock.transposeOpen.replace('{key}', 'G major'),
    });

    await chip.click();

    const popover = page.getByRole('dialog', { name: dock.transpose });
    await expect(popover).toBeVisible();
    await expect(page.getByText(dock.videoKeepsKey)).toBeVisible();
    // The popover zooms in; wait for it to settle before measuring.
    await page.waitForTimeout(400);
    const popoverBox = await popover.boundingBox();
    const chipBox = await chip.boundingBox();
    expect(popoverBox).not.toBeNull();
    expect(chipBox).not.toBeNull();
    expect(
      (popoverBox?.y ?? 0) + (popoverBox?.height ?? 0),
    ).toBeLessThanOrEqual(chipBox?.y ?? 0);
    expect(popoverBox?.x ?? -1).toBeGreaterThanOrEqual(0);
    expect((popoverBox?.x ?? 0) + (popoverBox?.width ?? 0)).toBeLessThanOrEqual(
      390,
    );
  });
});
