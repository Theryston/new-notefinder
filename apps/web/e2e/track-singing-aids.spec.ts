import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';

import { setTrackMock } from './fake-track-api';
import { messages } from './messages';

const voice = fileURLToPath(
  new URL('./fixtures/a4-440hz.wav', import.meta.url),
);
test.use({
  permissions: ['microphone'],
  launchOptions: {
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      `--use-file-for-fake-audio-capture=${voice}`,
    ],
  },
});

async function openTrack(page: Page, locale: 'en' | 'pt-BR', aid: string) {
  await page.setViewportSize(
    locale === 'pt-BR'
      ? { width: 390, height: 844 }
      : { width: 1280, height: 800 },
  );
  await page.emulateMedia({
    colorScheme: locale === 'pt-BR' ? 'dark' : 'light',
  });
  const id = `singing-aids-${aid}-${locale}`;
  await setTrackMock({
    tracks: [
      {
        id,
        title: 'Singing aids',
        youtubeVideoId: 'dQw4w9WgXcQ',
        durationMs: 60_000,
        processing: { status: 'COMPLETED' },
        notes: [{ pitch: 69, start: 0, end: 60 }],
      },
    ],
  });
  await page.goto(`/${locale}/tracks/${id}`);
}

for (const locale of ['en', 'pt-BR'] as const) {
  const t = messages[locale];
  test(`${locale}: immediate listening, mic count-in, cancellation and persisted settings`, async ({
    page,
  }) => {
    await openTrack(page, locale, 'count-in');
    const play = () =>
      page.getByRole('button', {
        name: t.tracks.practice.dock.play,
        exact: true,
      });
    await play().click();
    await expect(page.getByTestId('singing-count-in')).toHaveCount(0);
    await page
      .getByRole('button', { name: t.tracks.practice.dock.pause, exact: true })
      .click();
    await page
      .getByRole('button', { name: t.practice.mic.on, exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: t.practice.mic.off, exact: true }),
    ).toBeVisible();
    await page.clock.install({ time: new Date(0) });
    await page.clock.pauseAt(new Date(10_000));
    await play().click();
    await expect(page.getByTestId('singing-count-in')).toHaveText('3');
    await page.clock.runFor(1000);
    await expect(page.getByTestId('singing-count-in')).toHaveText('2');
    await page.clock.runFor(1000);
    await expect(page.getByTestId('singing-count-in')).toHaveText('1');
    await page.clock.runFor(1000);
    await expect(page.getByTestId('singing-count-in')).toHaveCount(0);
    await page
      .getByRole('button', { name: t.tracks.practice.dock.pause, exact: true })
      .click();
    await page.keyboard.press('Space');
    await expect(page.getByTestId('singing-count-in')).toHaveText('3');
    await page.keyboard.press('Space');
    await expect(page.getByTestId('singing-count-in')).toHaveCount(0);
    await page.clock.resume();
    await page
      .getByRole('button', {
        name: t.tracks.practice.dock.settings,
        exact: true,
      })
      .click();
    await expect(
      page.getByRole('menuitemcheckbox', { name: t.practice.aids.countIn }),
    ).toBeChecked();
    await page
      .getByRole('menuitemcheckbox', { name: t.practice.aids.countIn })
      .click();
    await page.keyboard.press('Escape');
    await page.reload();
    await page
      .getByRole('button', {
        name: t.tracks.practice.dock.settings,
        exact: true,
      })
      .click();
    await expect(
      page.getByRole('menuitemcheckbox', { name: t.practice.aids.countIn }),
    ).not.toBeChecked();
    await page.keyboard.press('Escape');
    await page
      .getByRole('button', { name: t.practice.mic.on, exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: t.practice.mic.off, exact: true }),
    ).toBeVisible();
    await play().click();
    await expect(page.getByTestId('singing-count-in')).toHaveCount(0);
    await expect(
      page.getByRole('button', {
        name: t.tracks.practice.dock.pause,
        exact: true,
      }),
    ).toBeVisible();
  });

  test(`${locale}: guide melody is opt-in and calibration explains the mic requirement`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await openTrack(page, locale, 'guide');
    const settings = () =>
      page
        .getByRole('button', {
          name: t.tracks.practice.dock.settings,
          exact: true,
        })
        .click();
    await settings();
    await expect(
      page.getByRole('menuitemcheckbox', { name: t.practice.aids.guideMelody }),
    ).not.toBeChecked();
    await page
      .getByRole('menuitemcheckbox', { name: t.practice.aids.guideMelody })
      .click();
    await page.keyboard.press('Escape');
    await page
      .getByRole('button', { name: t.tracks.practice.dock.play, exact: true })
      .click();
    await expect
      .poll(async () =>
        Number(
          await page
            .getByRole('slider', { name: t.tracks.practice.dock.progress })
            .getAttribute('aria-valuenow'),
        ),
      )
      .toBeGreaterThan(0);
    await page
      .getByRole('button', { name: t.tracks.practice.dock.pause, exact: true })
      .click();
    await page.reload();
    await settings();
    await expect(
      page.getByRole('menuitemcheckbox', { name: t.practice.aids.guideMelody }),
    ).toBeChecked();
    await page
      .getByRole('menuitem', { name: t.practice.aids.calibrate })
      .click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText(t.practice.aids.micRequired)).toBeVisible();
    await expect(
      dialog.getByRole('button', { name: t.practice.aids.start }),
    ).toBeDisabled();
    await dialog
      .getByRole('button', { name: t.practice.aids.close, exact: true })
      .click();
    expect(errors).toEqual([]);
  });
}

test('calibration stays visible and interactive inside browser fullscreen', async ({
  page,
}) => {
  await openTrack(page, 'en', 'fullscreen');
  await page
    .getByRole('button', {
      name: messages.en.tracks.practice.dock.settings,
      exact: true,
    })
    .click();
  await page
    .getByRole('menuitem', { name: messages.en.practice.aids.calibrate })
    .click();
  await page.locator('main').evaluate((element) => element.requestFullscreen());
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect
    .poll(() =>
      dialog.evaluate((element) => {
        const box = element.getBoundingClientRect();
        const top = document.elementFromPoint(
          box.x + box.width / 2,
          box.y + box.height / 2,
        );
        return (
          document.fullscreenElement?.contains(element) &&
          top !== null &&
          element.contains(top)
        );
      }),
    )
    .toBe(true);
  await dialog
    .getByRole('button', { name: messages.en.practice.aids.close, exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await page.evaluate(() => document.exitFullscreen());
});
