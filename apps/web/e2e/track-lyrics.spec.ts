import { expect, type Page, test } from '@playwright/test';

import { type FakeTrack, setTrackMock } from './fake-track-api';
import { messages } from './messages';

const dock = messages.en.tracks.practice.dock;

const DURATION_SECONDS = 248;

// Lines are 4 s apart; each word lasts a second, so a moment tells the word.
const lyricLine = (start: number, text: string) => ({
  start,
  end: start + 2,
  words: text.split(' ').map((word, index) => ({
    text: word,
    start: start + index,
    end: start + index + 1,
  })),
});

const lyrics = [
  lyricLine(2, 'Pressure pushing down'),
  lyricLine(10, 'On me pressing down on you'),
  lyricLine(20, 'No man ask for'),
  ...Array.from({ length: 40 }, (_, index) =>
    lyricLine(30 + index * 4, `Line number ${index + 1} of the chorus`),
  ),
];

const track = (id: string, overrides: Partial<FakeTrack> = {}): FakeTrack => ({
  id,
  title: 'Under Pressure',
  artistCredit: [{ name: 'Queen', joinPhrase: '' }],
  durationMs: DURATION_SECONDS * 1000,
  youtubeVideoId: 'dQw4w9WgXcQ',
  processing: { status: 'COMPLETED' },
  notes: [
    { pitch: 49, start: 0, end: 1.5 },
    { pitch: 64, start: 2, end: 3 },
  ],
  lyrics,
  contributors: [],
  ...overrides,
});

async function openTrack(page: Page, id: string, search = '') {
  await setTrackMock({ tracks: [track(id)] });
  await page.goto(`/en/tracks/${id}${search}`);
}

const progress = (page: Page) =>
  page.getByRole('slider', { name: dock.progress });

async function playedSeconds(page: Page): Promise<number> {
  return Number(await progress(page).getAttribute('aria-valuenow'));
}

const karaoke = (page: Page) => page.getByTestId('karaoke-line');

const lyricsBlock = (page: Page) =>
  page.getByRole('region', { name: messages.en.tracks.practice.lyrics.title });

test.describe('timed lyrics on the practice page', () => {
  test('shows the line being sung under the timeline, word by word', async ({
    page,
  }) => {
    await openTrack(page, 'clx-lyrics-karaoke');
    await expect(page.getByRole('button', { name: dock.play })).toBeEnabled();

    // Before the first line starts, it waits as what comes next.
    await expect(karaoke(page)).toHaveText('Pressure pushing down');
    await expect(karaoke(page).locator('[data-state="upcoming"]')).toHaveCount(
      3,
    );

    await lyricsBlock(page)
      .getByRole('button', { name: 'On me pressing down on you' })
      .click();
    await expect.poll(() => playedSeconds(page)).toBe(10);
    await expect(karaoke(page)).toHaveText('On me pressing down on you');
    await expect(karaoke(page).locator('[data-state="current"]')).toHaveText(
      'On',
    );

    await page.getByRole('button', { name: dock.play }).click();

    // The highlight moves along with the music: "On" is sung, "me" follows.
    await expect(karaoke(page).locator('[data-state="current"]')).toHaveText(
      'me',
    );
    await expect(karaoke(page).locator('[data-state="sung"]')).toHaveText('On');
  });

  test('seeks when a lyric line is clicked and marks it as the active one', async ({
    page,
  }) => {
    await openTrack(page, 'clx-lyrics-click');
    await expect(page.getByRole('button', { name: dock.play })).toBeEnabled();

    const line = lyricsBlock(page).getByRole('button', {
      name: 'No man ask for',
    });
    await expect(line).not.toHaveAttribute('aria-current', 'true');
    await line.click();

    await expect.poll(() => playedSeconds(page)).toBe(20);
    await expect(line).toHaveAttribute('aria-current', 'true');
    await expect(
      lyricsBlock(page).locator('[aria-current="true"]'),
    ).toHaveCount(1);
  });

  test('shows no lyrics block for a Track without Timed lyrics', async ({
    page,
  }) => {
    const id = 'clx-lyrics-none';
    await setTrackMock({ tracks: [track(id, { lyrics: [] })] });
    await page.goto(`/en/tracks/${id}`);

    await expect(
      page.getByRole('img', { name: /Under Pressure/ }),
    ).toBeVisible();
    await expect(lyricsBlock(page)).toHaveCount(0);
    await expect(karaoke(page)).toHaveCount(0);
  });

  test('positions playback at ?time= from an old shared link', async ({
    page,
  }) => {
    await openTrack(page, 'clx-lyrics-time', '?time=22');
    await expect(page.getByRole('button', { name: dock.play })).toBeEnabled();

    await expect.poll(() => playedSeconds(page)).toBe(22);
    await expect(karaoke(page)).toHaveText('No man ask for');
    // It positions the music, it does not start it.
    await expect(page.getByRole('button', { name: dock.play })).toBeVisible();
  });

  test('ignores a broken ?time=', async ({ page }) => {
    await openTrack(page, 'clx-lyrics-bad-time', '?time=soon');
    await expect(page.getByRole('button', { name: dock.play })).toBeEnabled();

    expect(await playedSeconds(page)).toBe(0);
  });

  test('scrolls to the timeline with ?timeline-focus=true', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 500 });
    await openTrack(page, 'clx-lyrics-focus', '?timeline-focus=true');
    const timeline = page.getByRole('img', { name: /Under Pressure/ });
    await expect(timeline).toBeVisible();

    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(0);
    const box = await timeline.boundingBox();
    expect(box?.y).toBeLessThan(150);
  });

  test('scrolls to the timeline with ?timeline-focus=true even when the notes failed to load', async ({
    page,
  }) => {
    const id = 'clx-lyrics-focus-failed';
    await setTrackMock({ tracks: [track(id, { notesFail: true })] });
    await page.setViewportSize({ width: 600, height: 500 });

    await page.goto(`/en/tracks/${id}?timeline-focus=true`);
    await expect(
      page.getByText(messages.en.tracks.practice.loadError),
    ).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(0);
  });

  test('stays at the top without ?timeline-focus=', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 500 });
    await openTrack(page, 'clx-lyrics-no-focus');
    await expect(
      page.getByRole('img', { name: /Under Pressure/ }),
    ).toBeVisible();

    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  test('keeps ?time= and ?timeline-focus= through a legacy ID redirect', async ({
    page,
  }) => {
    const newId = 'clx-lyrics-moved-new';
    const legacyId = 'legacy-lyrics-moved';
    await setTrackMock({
      tracks: [track(newId)],
      legacyMap: { [legacyId]: newId },
    });
    await page.setViewportSize({ width: 1280, height: 500 });

    await page.goto(`/en/tracks/${legacyId}?time=14&timeline-focus=true`);

    await expect(page).toHaveURL(
      new RegExp(`/en/tracks/${newId}\\?time=14&timeline-focus=true$`),
    );
    await expect(page.getByRole('button', { name: dock.play })).toBeEnabled();
    await expect.poll(() => playedSeconds(page)).toBe(14);
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(0);
  });
});
