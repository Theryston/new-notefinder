import { expect, type Page, test } from '@playwright/test';
import { createTranslator } from 'next-intl';

import { ADA, mockAuthApi } from './auth-api-mock';
import { setTrackMock } from './fake-track-api';
import { messages as catalogs } from './messages';

const cases = [
  { locale: 'en', messages: catalogs.en },
  { locale: 'pt-BR', messages: catalogs['pt-BR'] },
] as const;

const SINGER = { ...ADA, username: 'ada_singer' };

const contributor = (index: number) => ({
  id: `dialog-contributor-${index}`,
  username: `singer_${index}`,
  name: `Singer ${index}`,
  image: null,
});

const completeTrack = (id: string) => ({
  id,
  title: 'Contributor pagination',
  artistCredit: [],
  processing: {
    status: 'COMPLETED' as const,
    video: { id: 'dQw4w9WgXcQ', source: 'youtube_music' as const },
  },
  contributors: Array.from({ length: 21 }, (_, index) => contributor(index)),
});

const contributorApiPage = (start: number, end: number) => ({
  items: Array.from({ length: end - start }, (_, offset) =>
    contributor(start + offset),
  ),
  nextCursor: end < 21 ? 'next-page' : null,
  total: 21,
});

const openDialog = async (
  page: Page,
  trackId: string,
  locale: (typeof cases)[number]['locale'],
  messages: (typeof cases)[number]['messages'],
) => {
  await mockAuthApi(page, { user: SINGER });
  await setTrackMock({ tracks: [completeTrack(trackId)] });
  const translate = createTranslator({
    locale,
    messages,
    namespace: 'tracks.practice',
  });
  await page.goto(`/${locale}/tracks/${trackId}`);
  await page
    .getByRole('button', {
      name: translate('contributorsOpen', { count: 21 }),
    })
    .click();
  return {
    dialog: page.getByRole('dialog'),
    translate,
  };
};

for (const { locale, messages } of cases) {
  test(`paginates contributors only when the dialog list scrolls (${locale})`, async ({
    page,
  }) => {
    let releaseFirstPage: () => void = () => {};
    let notifyFirstRequest: () => void = () => {};
    const firstPageGate = new Promise<void>((resolve) => {
      releaseFirstPage = resolve;
    });
    const firstRequest = new Promise<void>((resolve) => {
      notifyFirstRequest = resolve;
    });
    let requests = 0;
    const trackId = `contributor-scroll-${locale}`;
    await page.route(`**/v1/tracks/${trackId}/contributors*`, async (route) => {
      const url = new URL(route.request().url());
      requests += 1;
      if (url.searchParams.has('cursor')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(contributorApiPage(20, 21)),
        });
        return;
      }
      notifyFirstRequest();
      await firstPageGate;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(contributorApiPage(0, 20)),
      });
    });
    const { dialog, translate } = await openDialog(
      page,
      trackId,
      locale,
      messages,
    );

    await firstRequest;
    await expect(
      dialog
        .getByRole('status')
        .getByText(translate('contributorsDialog.loading')),
    ).toBeVisible();
    await expect(
      dialog.getByText(
        translate('contributorsDialog.showing', { shown: 0, total: 0 }),
      ),
    ).toHaveCount(0);
    await expect(
      dialog.getByText(translate('contributorsDialog.empty', { query: '' })),
    ).toHaveCount(0);

    releaseFirstPage();
    await expect(
      dialog.getByText(
        translate('contributorsDialog.showing', { shown: 20, total: 21 }),
      ),
    ).toBeVisible();
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        }),
    );
    expect(requests).toBe(1);

    await dialog.getByRole('list').evaluate((list) => {
      list.scrollTop = list.scrollHeight;
    });
    await expect(
      dialog.getByText(
        translate('contributorsDialog.showing', { shown: 21, total: 21 }),
      ),
    ).toBeVisible();
    expect(requests).toBe(2);
  });

  test(`resumes pagination after retrying a failed page (${locale})`, async ({
    page,
  }) => {
    let failedNextPageAttempts = 0;
    let successfulNextPageAttempts = 0;
    let retryRefetchStarted = false;
    const trackId = `contributor-retry-${locale}`;
    await page.route(`**/v1/tracks/${trackId}/contributors*`, async (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.has('cursor')) {
        if (!retryRefetchStarted) {
          failedNextPageAttempts += 1;
          await route.fulfill({ status: 503, body: 'temporary error' });
          return;
        }
        successfulNextPageAttempts += 1;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(contributorApiPage(20, 21)),
        });
        return;
      }

      if (failedNextPageAttempts > 0) retryRefetchStarted = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(contributorApiPage(0, 20)),
      });
    });
    const { dialog, translate } = await openDialog(
      page,
      trackId,
      locale,
      messages,
    );

    await expect(
      dialog.getByText(
        translate('contributorsDialog.showing', { shown: 20, total: 21 }),
      ),
    ).toBeVisible();
    const list = dialog.getByRole('list');
    await list.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await dialog.getByRole('alert').waitFor();
    await expect(dialog.getByRole('alert')).toHaveText(
      translate('contributorsDialog.loadError'),
    );
    await dialog
      .getByRole('button', { name: translate('contributorsDialog.retry') })
      .click();
    await expect(
      dialog.getByText(
        translate('contributorsDialog.showing', { shown: 20, total: 21 }),
      ),
    ).toBeVisible();

    await list.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await expect(
      dialog.getByText(
        translate('contributorsDialog.showing', { shown: 21, total: 21 }),
      ),
    ).toBeVisible();
    expect(failedNextPageAttempts).toBeGreaterThan(0);
    expect(successfulNextPageAttempts).toBe(1);
  });
}
