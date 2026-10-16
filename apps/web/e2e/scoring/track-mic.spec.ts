import { expect, type Page, test } from '@playwright/test';
import { type FakeTrack, setTrackMock } from '../fake-track-api';
import { messages } from '../messages';

// This filename belongs to the existing chromium-mic project, whose fake WAV
// sings A4. It exercises capture, pitch detection and scoring together.
test.use({ permissions: ['microphone'] });

async function open(
  page: Page,
  id: string,
  options: { durationMs?: number; notes?: FakeTrack['notes'] } = {},
) {
  await page.addInitScript(() => {
    localStorage.setItem(
      'notefinder.singing-aids.v1',
      JSON.stringify({ countIn: false, guideMelody: false, offset: 0 }),
    );
  });
  await setTrackMock({
    tracks: [
      {
        id,
        title: 'Scoring practice',
        durationMs: options.durationMs ?? 12000,
        youtubeVideoId: 'dQw4w9WgXcQ',
        processing: { status: 'COMPLETED' },
        notes: options.notes ?? [
          { pitch: 69, start: 0.5, end: 4 },
          { pitch: 71, start: 4.1, end: 8 },
          { pitch: 81, start: 8.1, end: 11.5 },
        ],
      },
    ],
  });
  await page.goto(`/en/tracks/${id}`);
}

async function pixels(page: Page, token: string) {
  return page.evaluate((name) => {
    const canvas = document.querySelector('canvas');
    const context = canvas?.getContext('2d');
    const probe = document.createElement('canvas').getContext('2d');
    if (!canvas || !context || !probe) return 0;
    probe.fillStyle = getComputedStyle(canvas).getPropertyValue(name).trim();
    probe.fillRect(0, 0, 1, 1);
    const target = probe.getImageData(0, 0, 1, 1).data;
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0;
    for (let index = 0; index < data.length; index += 4) {
      if (
        [0, 1, 2].every(
          (channel) =>
            Math.abs((data[index + channel] ?? 0) - (target[channel] ?? 0)) < 5,
        )
      )
        count += 1;
    }
    return count;
  }, token);
}

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`live scoring (${colorScheme})`, () => {
    test.use({ colorScheme });
    test('colors matching notes green and reports the expected accuracy at the end', async ({
      page,
    }) => {
      await open(page, `scoring-${colorScheme}`);
      const t = messages.en;
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page
        .getByRole('button', { name: t.practice.mic.on, exact: true })
        .click();
      await expect(page.getByTestId('detected-note')).toHaveText('A4');
      await page
        .getByRole('button', { name: t.tracks.practice.dock.play, exact: true })
        .click();
      await expect(page.getByTestId('score-readout')).toContainText(
        t.practice.scoring.hit,
      );
      await page
        .getByRole('button', {
          name: t.tracks.practice.dock.pause,
          exact: true,
        })
        .click();
      await expect.poll(() => pixels(page, '--success')).toBeGreaterThan(100);
      await page
        .getByRole('button', { name: t.tracks.practice.dock.play, exact: true })
        .click();
      await expect(page.getByTestId('score-readout')).toContainText(
        t.practice.scoring.miss,
      );
      await page
        .getByRole('button', {
          name: t.tracks.practice.dock.pause,
          exact: true,
        })
        .click();
      await expect
        .poll(() => pixels(page, '--destructive'))
        .toBeGreaterThan(100);
      await page
        .getByRole('button', { name: t.tracks.practice.dock.play, exact: true })
        .click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByTestId('result-accuracy')).toHaveText('67%');
      await page
        .getByRole('button', { name: t.practice.scoring.tryAgain })
        .click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(
        page.getByRole('button', {
          name: t.tracks.practice.dock.pause,
          exact: true,
        }),
      ).toBeVisible();
      expect(errors).toEqual([]);
    });
  });
}

test('device settings persist and octave mode rejudges the current run immediately', async ({
  page,
}) => {
  await open(page, 'scoring-settings', { durationMs: 20000 });
  const t = messages.en;
  const settings = page.getByRole('button', {
    name: t.tracks.practice.dock.settings,
    exact: true,
  });
  await settings.click();
  await page
    .getByRole('menuitemradio', { name: t.practice.scoring.HARD, exact: true })
    .click();
  await page
    .getByRole('menuitemradio', { name: t.practice.scoring.EXACT, exact: true })
    .click();
  await page.keyboard.press('Escape');
  await page.reload();
  await settings.click();
  await expect(
    page.getByRole('menuitemradio', {
      name: t.practice.scoring.HARD,
      exact: true,
    }),
  ).toHaveAttribute('aria-checked', 'true');
  await expect(
    page.getByRole('menuitemradio', {
      name: t.practice.scoring.EXACT,
      exact: true,
    }),
  ).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Escape');
  await page
    .getByRole('button', { name: t.practice.mic.on, exact: true })
    .click();
  await expect(page.getByTestId('detected-note')).toHaveText('A4');
  await page
    .getByRole('button', { name: t.tracks.practice.dock.play, exact: true })
    .click();
  await expect(page.getByTestId('score-readout')).toContainText('33%');
  await page
    .getByRole('button', { name: t.tracks.practice.dock.pause, exact: true })
    .click();
  await settings.click();
  await page
    .getByRole('menuitemradio', { name: t.practice.scoring.ANY, exact: true })
    .click();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('score-readout')).toContainText('67%');
  await page
    .getByRole('button', { name: t.practice.scoring.stop, exact: true })
    .click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByTestId('result-accuracy')).toHaveText('67%');
});

test('loop sections show a live score and never open a result sheet', async ({
  page,
}) => {
  await open(page, 'scoring-loop');
  const t = messages.en;
  await page
    .getByRole('button', { name: t.tracks.practice.dock.settings, exact: true })
    .click();
  await page
    .getByRole('menuitemcheckbox', {
      name: t.tracks.practice.listening.loop,
      exact: true,
    })
    .click();
  await page
    .getByRole('button', { name: t.practice.mic.on, exact: true })
    .click();
  await expect(page.getByTestId('detected-note')).toHaveText('A4');
  await page
    .getByRole('button', { name: t.tracks.practice.dock.play, exact: true })
    .click();
  await expect(page.getByTestId('score-readout')).toContainText(
    'Section: 100%',
  );
  await page
    .getByRole('button', { name: t.practice.scoring.stop, exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('turning off the mic finishes the run and Try again turns it back on', async ({
  page,
}) => {
  await open(page, 'scoring-mic-stop', { durationMs: 20000 });
  const t = messages.en;
  await page
    .getByRole('button', { name: t.practice.mic.on, exact: true })
    .click();
  await expect(page.getByTestId('detected-note')).toHaveText('A4');
  await page
    .getByRole('button', { name: t.tracks.practice.dock.play, exact: true })
    .click();
  await expect(page.getByTestId('score-readout')).toContainText('100%');
  await page
    .getByRole('button', { name: t.practice.mic.off, exact: true })
    .click();
  await expect(page.getByTestId('result-accuracy')).toHaveText('100%');
  await page
    .getByRole('button', { name: t.practice.scoring.tryAgain, exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: t.practice.mic.off, exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('instrumental tracks hydrate settings and preserve the untouched preference', async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('notefinder.scoring.v1'))
      localStorage.setItem(
        'notefinder.scoring.v1',
        JSON.stringify({ difficulty: 'HARD', octaveMode: 'EXACT' }),
      );
  });
  await open(page, 'scoring-instrumental', { notes: [] });
  const t = messages.en;
  const settings = page.getByRole('button', {
    name: t.tracks.practice.dock.settings,
    exact: true,
  });
  await settings.click();
  await expect(
    page.getByRole('menuitemradio', {
      name: t.practice.scoring.HARD,
      exact: true,
    }),
  ).toHaveAttribute('aria-checked', 'true');
  await expect(
    page.getByRole('menuitemradio', {
      name: t.practice.scoring.EXACT,
      exact: true,
    }),
  ).toHaveAttribute('aria-checked', 'true');
  await page
    .getByRole('menuitemradio', { name: t.practice.scoring.EASY, exact: true })
    .click();
  await page.keyboard.press('Escape');
  await page.reload();
  await settings.click();
  await expect(
    page.getByRole('menuitemradio', {
      name: t.practice.scoring.EASY,
      exact: true,
    }),
  ).toHaveAttribute('aria-checked', 'true');
  await expect(
    page.getByRole('menuitemradio', {
      name: t.practice.scoring.EXACT,
      exact: true,
    }),
  ).toHaveAttribute('aria-checked', 'true');
});

test('saved exact octave mode judges a reloaded track before Settings is opened', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'notefinder.scoring.v1',
      JSON.stringify({ difficulty: 'HARD', octaveMode: 'EXACT' }),
    );
  });
  await open(page, 'scoring-saved-before-menu', { durationMs: 20000 });
  const t = messages.en;
  await page
    .getByRole('button', { name: t.practice.mic.on, exact: true })
    .click();
  await expect(page.getByTestId('detected-note')).toHaveText('A4');
  await page
    .getByRole('button', { name: t.tracks.practice.dock.play, exact: true })
    .click();
  await expect(page.getByTestId('score-readout')).toContainText('33%');
  await page
    .getByRole('button', { name: t.practice.scoring.stop, exact: true })
    .click();
  await expect(page.getByTestId('result-accuracy')).toHaveText('33%');
});
