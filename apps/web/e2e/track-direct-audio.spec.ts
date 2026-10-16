import { expect, test } from '@playwright/test';

import { ADA } from './auth-api-mock';
import { setTrackMock } from './fake-track-api';

const urls = {
  musicMp3Url: 'https://audio.example/music.mp3',
  vocalsMp3Url: 'https://audio.example/vocals.mp3',
};

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
]) {
  test(`admin waveform seeks and switches vocals (${viewport.width})`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const id = `direct-audio-admin-${viewport.width}`;
    await setTrackMock({
      tracks: [
        {
          id,
          title: 'Direct audio',
          durationMs: 120_000,
          processing: { status: 'COMPLETED' },
          notes: [{ pitch: 60, start: 0, end: 2 }],
        },
      ],
    });
    await page.route('**/v1/auth/get-session', (route) =>
      route.fulfill({
        json: {
          session: { id: 'admin' },
          user: { ...ADA, role: 'ADMIN', username: 'admin' },
        },
      }),
    );
    let reads = 0;
    await page.route(`**/v1/tracks/${id}/audio`, (route) => {
      reads++;
      return route.fulfill({ json: urls });
    });
    await page.goto(`/en/tracks/${id}`);
    await expect(page.getByTestId('audio-waveform')).toBeVisible();
    await expect(page.getByTestId('dock-video')).toHaveCount(0);
    expect(reads).toBe(1);
    const vocals = page.getByRole('button', { name: 'Vocals only' });
    await vocals.click();
    await expect(vocals).toHaveAttribute('aria-pressed', 'true');
    await vocals.click();
    await expect(vocals).toHaveAttribute('aria-pressed', 'false');
    const seek = page.getByRole('slider', { name: 'Playback position' });
    const box = await seek.boundingBox();
    if (!box) throw new Error('Seek track is missing');
    await page.mouse.move(box.x + box.width * 0.25, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2);
    await page.mouse.up();
    await expect(seek).toHaveAttribute('aria-valuenow', '60');
  });
}

test('ordinary listeners keep YouTube and never request direct audio', async ({
  page,
}) => {
  const id = 'direct-audio-user';
  await setTrackMock({
    tracks: [
      {
        id,
        title: 'YouTube audio',
        youtubeVideoId: 'a01QQZyl-_I',
        durationMs: 120_000,
        processing: { status: 'COMPLETED' },
      },
    ],
  });
  await page.route('**/v1/auth/get-session', (route) =>
    route.fulfill({
      json: {
        session: { id: 'user' },
        user: { ...ADA, role: 'USER', username: 'ada' },
      },
    }),
  );
  let reads = 0;
  await page.route(`**/v1/tracks/${id}/audio`, (route) => {
    reads++;
    return route.fulfill({
      status: 403,
      json: {
        code: 'FORBIDDEN',
        statusCode: 403,
        message: 'Direct audio is restricted',
      },
    });
  });
  await page.goto(`/en/tracks/${id}`);
  await expect(page.getByTestId('dock-video')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Vocals only' })).toHaveCount(
    0,
  );
  expect(reads).toBe(0);
  // Exercise a stale admin session: the API refuses URLs and the dock stays on YouTube.
  await page.route('**/v1/auth/get-session', (route) =>
    route.fulfill({
      json: {
        session: { id: 'stale' },
        user: { ...ADA, role: 'ADMIN', username: 'ada' },
      },
    }),
  );
  await page.reload();
  await expect.poll(() => reads).toBe(1);
  await expect(page.getByTestId('dock-video')).toBeVisible();
  await expect(page.getByTestId('audio-waveform')).toHaveCount(0);
});
