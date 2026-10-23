import { expect, test } from '@playwright/test';
import { mockAdminPinsApi } from './admin-pins-api-mock';
import { adminLocales, adminUser } from './admin-users';
import { mockAuthApi } from './auth-api-mock';

const pickerTracks = [
  {
    id: 'trk_preview',
    title: 'Preview song',
    artistCredit: [{ name: 'Preview artist', joinPhrase: '' }],
    coverUrl: 'https://cdn.example/preview.webp',
  },
];

for (const { locale, copy } of adminLocales) {
  test(`${locale}: opens a preview from the unsaved pin form`, async ({
    page,
  }) => {
    await mockAuthApi(page, { user: adminUser });
    const api = await mockAdminPinsApi(page, { tracks: pickerTracks });
    const pins = copy.adminHomePins;

    await page.goto(`/${locale}/admin/home-pins`);
    await page.getByRole('button', { name: pins.create }).click();
    const form = page.getByRole('dialog').first();
    await form.getByLabel(pins.form.trackPicker.searchLabel).fill('Preview');
    await form.getByRole('button', { name: /Preview song/ }).click();
    await form.getByLabel(pins.form.titleEn.label).fill('Preview picks');
    await form.getByLabel(pins.form.titlePt.label).fill('Escolhas da prévia');
    await form.getByRole('button', { name: pins.form.preview }).click();

    const preview = page.getByRole('dialog').last();
    await expect(
      preview.getByRole('heading', { name: pins.form.previewDialog.title }),
    ).toBeVisible();
    await expect(
      preview.getByText(pins.form.previewDialog.empty),
    ).toBeVisible();
    const firstPreview = api.calls.find((call) =>
      call.url().includes('/home-pins/preview'),
    );
    expect(firstPreview?.postDataJSON()).toMatchObject({
      audience: 'visitor',
      pin: {
        source: { type: 'tracks', trackIds: ['trk_preview'] },
        titles: { en: 'Preview picks', 'pt-BR': 'Escolhas da prévia' },
      },
    });

    await preview
      .getByLabel(pins.form.previewDialog.locale)
      .selectOption('pt-BR');
    await preview
      .getByLabel(pins.form.previewDialog.audience)
      .selectOption('signed-in');
    await expect
      .poll(() =>
        api.calls
          .filter((call) => call.url().includes('/home-pins/preview'))
          .at(-1)
          ?.postDataJSON(),
      )
      .toMatchObject({ audience: 'signed-in', locale: 'pt-BR' });
  });
}
